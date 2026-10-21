import { describe, expect, it } from 'vitest';
import type { DateKey, DayDoc, SlotRef } from '../../types';
import { lastHourWindow } from '../time';
import { applyEntry, emptySlots, planDrop, undoDrop } from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const TZ = 'America/Los_Angeles';
const T = '2026-06-10';
const Y = '2026-06-09';
const NOW = new Date(2026, 5, 10, 14, 20);
const LATE = new Date(2026, 5, 10, 23, 50);

type Days = Record<DateKey, DayDoc | undefined>;

const mk = (set: Record<number, string> = {}, notes: Record<string, string> = {}): DayDoc => {
  const a = emptySlots().split('');
  for (const [i, c] of Object.entries(set)) a[Number(i)] = c;
  return { slots: a.join(''), notes, sleep: { start: '22:00', end: '06:00' }, tz: TZ, v: 1 };
};
const range = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));
const refs = (date: DateKey, ...slots: number[]): SlotRef[] =>
  slots.map((slot) => ({ date, slot }));
const merge = (days: Days, changed: Days): Days => ({ ...days, ...changed });
const drop = (days: Days, targets: SlotRef[], category: 'g' | 'b' | 'r', now = NOW) =>
  planDrop({ days, targets, category, sleep: SLEEP, tz: TZ, now });

describe('planDrop', () => {
  it('creates a missing doc with the sleep snapshot and tz', () => {
    const plan = drop({}, refs(T, 27, 28), 'g');
    expect(plan.noop).toBe(false);
    expect(Object.keys(plan.changed)).toEqual([T]);
    const doc = plan.changed[T]!;
    expect(doc.slots).toBe(mk({ 27: 'g', 28: 'g' }).slots);
    expect(doc.sleep).toEqual(SLEEP);
    expect(doc.tz).toBe(TZ);
    expect(doc.notes).toEqual({});
    expect(doc.v).toBe(1);
  });

  it('does not mutate the input', () => {
    const days = { [T]: mk(range(26, 30, 'b'), { '26': 'x' }) };
    const copy = JSON.parse(JSON.stringify(days));
    drop(days, refs(T, 27, 28), 'g');
    expect(days).toEqual(copy);
  });

  it('overwrites a partially logged window, keeping the rest of the runs', () => {
    const days = { [T]: mk({ ...range(25, 28, 'b'), 28: 'r', 29: 'r' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.changed[T]!.slots).toBe(mk({ 25: 'b', 26: 'b', 27: 'g', 28: 'g', 29: 'r' }).slots);
    expect(plan.undo.slots).toEqual([
      { date: T, slot: 27, prev: 'b' },
      { date: T, slot: 28, prev: 'r' },
    ]);
  });

  it('fills a window that is half logged with the same category', () => {
    const days = { [T]: mk({ 27: 'g' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.noop).toBe(false);
    expect(plan.changed[T]!.slots).toBe(mk({ 27: 'g', 28: 'g' }).slots);
  });

  it('is a noop when every target already holds the category', () => {
    const days = { [T]: mk(range(26, 30, 'g'), { '26': 'keep' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.noop).toBe(true);
    expect(plan.changed).toEqual({});
    expect(plan.undo.slots).toEqual([]);
  });

  it('is not a noop when the same slots hold a different category', () => {
    const days = { [T]: mk(range(27, 29, 'g')) };
    expect(drop(days, refs(T, 27, 28), 'b').noop).toBe(false);
  });

  it('a repeat drop with a different category changes the same window', () => {
    const first = drop({}, refs(T, 27, 28), 'g');
    const days = merge({}, first.changed);
    const second = drop(days, refs(T, 27, 28), 'b');
    expect(second.noop).toBe(false);
    expect(second.changed[T]!.slots).toBe(mk({ 27: 'b', 28: 'b' }).slots);
  });

  it('drops notes inside the window and records them for undo', () => {
    const days = { [T]: mk(range(27, 30, 'b'), { '27': 'run note' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.changed[T]!.notes).toEqual({});
    expect(plan.undo.removedNotes).toEqual([{ date: T, key: '27', text: 'run note' }]);
  });

  it('keeps a note outside the window', () => {
    const days = {
      [T]: mk({ ...range(20, 22, 'b'), ...range(27, 29, 'r') }, { '20': 'out', '27': 'in' }),
    };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.changed[T]!.notes).toEqual({ '20': 'out' });
    expect(plan.undo.removedNotes).toEqual([{ date: T, key: '27', text: 'in' }]);
  });

  it('fills sleep and unlogged slots silently (stored sleep snapshot is untouched)', () => {
    const days = { [T]: mk() };
    const plan = drop(days, refs(T, 44, 45, 46, 47), 'b', LATE);
    expect(plan.changed[T]!.slots).toBe(mk(range(44, 48, 'b')).slots);
    expect(plan.changed[T]!.sleep).toEqual({ start: '22:00', end: '06:00' });
  });

  it('a midnight-spanning window changes 2 docs (both created)', () => {
    const now = new Date(2026, 5, 10, 0, 20);
    const plan = drop({}, lastHourWindow(now), 'g', now);
    expect(Object.keys(plan.changed).sort()).toEqual([Y, T]);
    expect(plan.changed[Y]!.slots).toBe(mk({ 47: 'g' }).slots);
    expect(plan.changed[T]!.slots).toBe(mk({ 0: 'g' }).slots);
    expect(plan.changed[Y]!.sleep).toEqual(SLEEP);
    expect(plan.changed[T]!.sleep).toEqual(SLEEP);
  });

  it('a midnight window with an existing neighbour only changes docs that differ', () => {
    const now = new Date(2026, 5, 10, 0, 20);
    const days = { [Y]: mk({ 47: 'g' }) };
    const plan = drop(days, lastHourWindow(now), 'g', now);
    expect(Object.keys(plan.changed)).toEqual([T]);
  });

  it('00:00 window only touches yesterday', () => {
    const now = new Date(2026, 5, 10, 0, 5);
    const plan = drop({}, lastHourWindow(now), 'r', now);
    expect(Object.keys(plan.changed)).toEqual([Y]);
    expect(plan.changed[Y]!.slots).toBe(mk({ 46: 'r', 47: 'r' }).slots);
  });

  it('writes non-adjacent targets as separate runs (spring-forward skip)', () => {
    const now = new Date(2026, 2, 8, 3, 35);
    const day = '2026-03-08';
    const plan = drop({}, lastHourWindow(now), 'g', now);
    expect(plan.changed[day]!.slots).toBe(mk({ 3: 'g', 6: 'g' }).slots);
  });

  it('ignores targets in the future', () => {
    const now = new Date(2026, 5, 10, 14, 0);
    const plan = drop({}, refs(T, 27, 28, 29), 'g', now);
    expect(plan.changed[T]!.slots).toBe(mk({ 27: 'g', 28: 'g' }).slots);
    expect(drop({}, refs(T, 40), 'g', now).noop).toBe(true);
  });

  it('next to a same-category entry it stays its own entry, undoable', () => {
    const days = { [T]: mk(range(29, 32, 'g'), { '29': 'later' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(plan.changed[T]!.slots).toBe(mk(range(27, 32, 'g')).slots);
    expect(plan.changed[T]!.notes).toEqual({ '29': 'later' });
    expect(plan.changed[T]!.breaks).toBe(mk({ 29: '|' }).slots);
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[T]).toEqual(days[T]);
  });
});

describe('undoDrop', () => {
  it('restores previous characters and notes (round trip)', () => {
    const days = { [T]: mk({ ...range(26, 29, 'b'), 29: 'r' }, { '26': 'a note' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[T]).toEqual(days[T]);
  });

  it('restores a two-doc midnight drop; created docs stay as empty docs', () => {
    const now = new Date(2026, 5, 10, 0, 20);
    const days = { [Y]: mk({ 47: 'b' }, { '47': 'old' }) };
    const plan = drop(days, lastHourWindow(now), 'g', now);
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(Object.keys(undone).sort()).toEqual([Y, T]);
    expect(undone[Y]).toEqual(days[Y]);
    expect(undone[T]!.slots).toBe(emptySlots());
    expect(undone[T]!.notes).toEqual({});
  });

  it('restores sleep/unlogged slots to unlogged', () => {
    const plan = drop({}, refs(T, 46, 47), 'b', LATE);
    const undone = undoDrop(plan.changed, plan.undo);
    expect(undone[T]!.slots).toBe(emptySlots());
  });

  it('after an intervening edit only restores slots that still hold the dropped category', () => {
    const days = { [T]: mk(range(26, 30, 'b'), { '26': 'orig' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    const afterDrop = merge(days, plan.changed);
    const edited = merge(
      afterDrop,
      applyEntry(
        afterDrop,
        { date: T, startSlot: 28, length: 1, category: 'r', note: 'mine' },
        { sleep: SLEEP, tz: TZ },
      ),
    );
    expect(edited[T]!.slots).toBe(mk({ 26: 'b', 27: 'g', 28: 'r', 29: 'b' }).slots);
    const undone = undoDrop(edited, plan.undo);
    expect(undone[T]!.slots).toBe(mk({ 26: 'b', 27: 'b', 28: 'r', 29: 'b' }).slots);
    expect(undone[T]!.notes).toEqual({ '26': 'orig', '28': 'mine' });
  });

  it('does not clobber a note key that exists now', () => {
    const days = { [T]: mk(range(26, 30, 'b'), { '26': 'orig' }) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    const afterDrop = merge(days, plan.changed);
    const edited = {
      [T]: {
        ...afterDrop[T]!,
        slots: mk({ 26: 'b', 27: 'g', 28: 'g', 29: 'b' }).slots,
        notes: { '26': 'newer' },
      },
    };
    const undone = undoDrop(edited, plan.undo);
    expect(undone[T]!.notes).toEqual({ '26': 'newer' });
  });

  it('is a no-change when nothing still holds the category', () => {
    const days = { [T]: mk(range(26, 30, 'b')) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    const afterDrop = merge(days, plan.changed);
    const edited = {
      [T]: { ...afterDrop[T]!, slots: mk(range(26, 30, 'r')).slots },
    };
    expect(undoDrop(edited, plan.undo)).toEqual({});
  });

  it('is a no-change for a noop plan and for missing docs', () => {
    const days = { [T]: mk(range(27, 29, 'g')) };
    const plan = drop(days, refs(T, 27, 28), 'g');
    expect(undoDrop(days, plan.undo)).toEqual({});
    const real = drop({}, refs(T, 27, 28), 'g');
    expect(undoDrop({}, real.undo)).toEqual({});
  });
});
