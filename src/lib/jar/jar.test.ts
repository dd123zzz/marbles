import { describe, expect, it } from 'vitest';
import type { Marble, MarbleColor } from '../../types';
import {
  CATEGORY_LABEL,
  MARBLE_COLORS,
  computeMarbles,
  formatSummary,
  hasLoggedSlots,
  isEmptyPastDay,
  summarize,
} from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const NO_SLEEP = { start: '00:00', end: '00:00' };
const dots = (): string[] => Array<string>(48).fill('.');
const make = (set: Record<number, string>): string => {
  const a = dots();
  for (const [i, c] of Object.entries(set)) a[Number(i)] = c;
  return a.join('');
};
const fill = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));

const DAY = '2026-06-10';
const evening = new Date(2026, 5, 10, 23, 59);
const nextDay = new Date(2026, 5, 11, 12, 0);

describe('computeMarbles', () => {
  it('returns 24 marbles indexed by hour', () => {
    const m = computeMarbles({ date: DAY, slots: undefined, sleep: SLEEP, now: nextDay });
    expect(m).toHaveLength(24);
    expect(m.map((x) => x.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it('a fully logged hour is full with a single label', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make(fill(26, 28, 'g')),
      sleep: SLEEP,
      now: nextDay,
    });
    expect(m[13]).toEqual({
      hour: 13,
      left: 'g',
      right: 'g',
      full: true,
      label: '13:00–14:00 Wanted',
    });
  });

  it('mixed halves are not full and label both halves', () => {
    const m = computeMarbles({ date: DAY, slots: make({ 26: 'g' }), sleep: SLEEP, now: nextDay });
    expect(m[13]).toEqual({
      hour: 13,
      left: 'g',
      right: 'unlogged',
      full: false,
      label: '13:00–13:30 Wanted, 13:30–14:00 Unlogged',
    });
  });

  it('two different logged categories in one hour', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make({ 20: 'b', 21: 'r' }),
      sleep: SLEEP,
      now: nextDay,
    });
    expect(m[10]).toMatchObject({ left: 'b', right: 'r', full: false });
    expect(m[10]!.label).toBe('10:00–10:30 Wasted, 10:30–11:00 Unwanted');
  });

  it('right-half-only logging', () => {
    const m = computeMarbles({ date: DAY, slots: make({ 21: 'r' }), sleep: SLEEP, now: nextDay });
    expect(m[10]).toMatchObject({ left: 'unlogged', right: 'r' });
  });

  it('hour 23 label ends at 24:00', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make(fill(46, 48, 'b')),
      sleep: SLEEP,
      now: nextDay,
    });
    expect(m[23]!.label).toBe('23:00–24:00 Wasted');
  });

  it('sleep fills unlogged slots in the window, wrapping midnight', () => {
    const m = computeMarbles({ date: DAY, slots: undefined, sleep: SLEEP, now: nextDay });
    for (let h = 0; h < 7; h++)
      expect(m[h]).toMatchObject({ left: 'sleep', right: 'sleep', full: true });
    for (let h = 7; h < 23; h++)
      expect(m[h]).toMatchObject({ left: 'unlogged', right: 'unlogged' });
    expect(m[23]).toMatchObject({ left: 'sleep', right: 'sleep' });
    expect(m[3]!.label).toBe('03:00–04:00 Sleep');
  });

  it('logged slots beat sleep', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make({ 2: 'g', 3: 'b' }),
      sleep: SLEEP,
      now: nextDay,
    });
    expect(m[1]).toMatchObject({ left: 'g', right: 'b' });
    expect(m[0]).toMatchObject({ left: 'sleep', right: 'sleep' });
  });

  it('sleep boundary at 07:00 (slot 14) is awake', () => {
    const m = computeMarbles({
      date: DAY,
      slots: undefined,
      sleep: { start: '23:00', end: '07:30' },
      now: nextDay,
    });
    expect(m[7]).toMatchObject({ left: 'sleep', right: 'unlogged' });
  });

  it('start == end disables sleep', () => {
    const m = computeMarbles({ date: DAY, slots: undefined, sleep: NO_SLEEP, now: nextDay });
    expect(m.every((x) => x.left === 'unlogged' && x.right === 'unlogged')).toBe(true);
  });

  it('future slots are empty, even inside the sleep window', () => {
    const now = new Date(2026, 5, 10, 14, 20);
    const m = computeMarbles({ date: DAY, slots: undefined, sleep: SLEEP, now });
    expect(m[23]).toMatchObject({ left: 'empty', right: 'empty', full: true });
    expect(m[23]!.label).toBe('23:00–24:00 Not yet');
    expect(m[16]).toMatchObject({ left: 'empty', right: 'empty' });
    expect(m[0]).toMatchObject({ left: 'sleep', right: 'sleep' });
  });

  it('a whole future day is empty, sleep included', () => {
    const m = computeMarbles({
      date: '2026-06-11',
      slots: undefined,
      sleep: SLEEP,
      now: new Date(2026, 5, 10, 14, 20),
    });
    expect(m.every((x) => x.left === 'empty' && x.right === 'empty')).toBe(true);
  });

  it('the current, partly elapsed slot is unlogged, not empty', () => {
    const now = new Date(2026, 5, 10, 14, 20);
    const m = computeMarbles({ date: DAY, slots: undefined, sleep: SLEEP, now });
    expect(m[14]).toMatchObject({ left: 'unlogged', right: 'empty', full: false });
    expect(m[14]!.label).toBe('14:00–14:30 Unlogged, 14:30–15:00 Not yet');
  });

  it('on a slot boundary the slot that just started is unlogged', () => {
    const m = computeMarbles({
      date: DAY,
      slots: undefined,
      sleep: SLEEP,
      now: new Date(2026, 5, 10, 14, 30),
    });
    expect(m[14]).toMatchObject({ left: 'unlogged', right: 'unlogged' });
    expect(m[15]).toMatchObject({ left: 'empty' });
  });

  it('the current slot in the sleep window is sleep', () => {
    const m = computeMarbles({
      date: DAY,
      slots: undefined,
      sleep: SLEEP,
      now: new Date(2026, 5, 10, 3, 10),
    });
    expect(m[3]).toMatchObject({ left: 'sleep', right: 'empty' });
  });

  it('logged slots show even when in the future (log wins over empty)', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make({ 40: 'g' }),
      sleep: SLEEP,
      now: new Date(2026, 5, 10, 14, 20),
    });
    expect(m[20]).toMatchObject({ left: 'g', right: 'empty' });
  });

  it('tolerates a short slots string', () => {
    const m = computeMarbles({ date: DAY, slots: 'gg', sleep: NO_SLEEP, now: nextDay });
    expect(m[0]).toMatchObject({ left: 'g', right: 'g' });
    expect(m[1]).toMatchObject({ left: 'unlogged' });
  });

  describe('DST', () => {
    const now = new Date(2026, 2, 9, 12, 0);
    it('spring-forward 2026-03-08: hour 2 is n/a', () => {
      const m = computeMarbles({ date: '2026-03-08', slots: undefined, sleep: SLEEP, now });
      expect(m[2]).toEqual({
        hour: 2,
        left: 'na',
        right: 'na',
        full: true,
        label: '02:00–03:00 Not applicable (DST)',
      });
      expect(m.filter((x) => x.left === 'na' || x.right === 'na')).toHaveLength(1);
      expect(m[1]).toMatchObject({ left: 'sleep' });
      expect(m[3]).toMatchObject({ left: 'sleep' });
    });
    it('n/a beats a logged char and sleep', () => {
      const m = computeMarbles({
        date: '2026-03-08',
        slots: make({ 4: 'g', 5: 'g' }),
        sleep: SLEEP,
        now,
      });
      expect(m[2]).toMatchObject({ left: 'na', right: 'na' });
    });
    it('n/a beats future', () => {
      const m = computeMarbles({
        date: '2026-03-08',
        slots: undefined,
        sleep: SLEEP,
        now: new Date(2026, 2, 8, 1, 0),
      });
      expect(m[2]).toMatchObject({ left: 'na', right: 'na' });
      expect(m[3]).toMatchObject({ left: 'empty' });
    });
    it('fall-back 2026-11-01 has no n/a marbles', () => {
      const m = computeMarbles({
        date: '2026-11-01',
        slots: undefined,
        sleep: SLEEP,
        now: new Date(2026, 10, 2, 12, 0),
      });
      expect(m.some((x) => x.left === 'na' || x.right === 'na')).toBe(false);
      expect(m[1]).toMatchObject({ left: 'sleep', right: 'sleep' });
    });
    it('n/a is not counted in the summary', () => {
      const m = computeMarbles({ date: '2026-03-08', slots: undefined, sleep: NO_SLEEP, now });
      expect(summarize(m).unlogged).toBe(23);
    });
  });
});

describe('summarize / formatSummary', () => {
  const marble = (left: MarbleColor, right: MarbleColor): Marble => ({
    hour: 0,
    left,
    right,
    full: left === right,
    label: '',
  });

  it('counts 0.5h per half', () => {
    const sum = summarize([
      marble('g', 'g'),
      marble('g', 'b'),
      marble('r', 'sleep'),
      marble('unlogged', 'empty'),
      marble('na', 'na'),
    ]);
    expect(sum).toEqual({ g: 1.5, b: 0.5, r: 0.5, sleep: 0.5, unlogged: 0.5 });
  });

  it('empty input is all zero', () => {
    expect(summarize([])).toEqual({ g: 0, b: 0, r: 0, sleep: 0, unlogged: 0 });
  });

  it('a full day adds up to 24h', () => {
    const m = computeMarbles({
      date: DAY,
      slots: make({ ...fill(14, 26, 'g'), ...fill(26, 31, 'b'), ...fill(31, 33, 'r') }),
      sleep: SLEEP,
      now: nextDay,
    });
    const s = summarize(m);
    expect(s.g).toBe(6);
    expect(s.b).toBe(2.5);
    expect(s.r).toBe(1);
    expect(s.sleep).toBe(8);
    expect(s.unlogged).toBe(6.5);
    expect(s.g + s.b + s.r + s.sleep + s.unlogged).toBe(24);
  });

  it('formats all five', () => {
    expect(formatSummary({ g: 6, b: 2.5, r: 1, sleep: 8, unlogged: 3.5 })).toBe(
      'G 6h · B 2.5h · R 1h · Sleep 8h · Unlogged 3.5h',
    );
    expect(formatSummary({ g: 0, b: 0, r: 0, sleep: 0, unlogged: 0 })).toBe(
      'G 0h · B 0h · R 0h · Sleep 0h · Unlogged 0h',
    );
  });

  it('end-to-end example from the spec', () => {
    const slots = make({ ...fill(26, 38, 'g'), ...fill(38, 43, 'b'), ...fill(43, 45, 'r') });
    const m = computeMarbles({ date: DAY, slots, sleep: SLEEP, now: evening });
    expect(formatSummary(summarize(m))).toBe('G 6h · B 2.5h · R 1h · Sleep 8h · Unlogged 6.5h');
  });
});

describe('constants', () => {
  it('colors', () => {
    expect(MARBLE_COLORS).toEqual({
      g: '#16a34a',
      b: '#111827',
      r: '#dc2626',
      sleep: '#4f46e5',
      unlogged: '#9ca3af',
      empty: 'transparent',
      na: '#e5e7eb',
    });
  });
  it('labels', () => {
    expect(CATEGORY_LABEL.g).toBe('Wanted');
    expect(CATEGORY_LABEL.b).toBe('Wasted');
    expect(CATEGORY_LABEL.r).toBe('Unwanted');
    expect(CATEGORY_LABEL.sleep).toBe('Sleep');
    expect(CATEGORY_LABEL.unlogged).toBe('Unlogged');
    expect(CATEGORY_LABEL.empty).toBe('Not yet');
    expect(CATEGORY_LABEL.na).toContain('Not applicable');
  });
});

describe('hasLoggedSlots', () => {
  it('is false for a missing doc and for all-unlogged slots', () => {
    expect(hasLoggedSlots(undefined)).toBe(false);
    expect(hasLoggedSlots('')).toBe(false);
    expect(hasLoggedSlots('.'.repeat(48))).toBe(false);
  });

  it('is true for any g, b or r slot', () => {
    for (const c of ['g', 'b', 'r']) expect(hasLoggedSlots(make({ 47: c }))).toBe(true);
    expect(hasLoggedSlots(make({ 0: 'g' }))).toBe(true);
  });
});

describe('isEmptyPastDay', () => {
  const blank = '.'.repeat(48);
  it('is true only for days before today with nothing logged', () => {
    expect(isEmptyPastDay('2026-10-13', '2026-10-14', undefined)).toBe(true);
    expect(isEmptyPastDay('2026-10-13', '2026-10-14', blank)).toBe(true);
    expect(isEmptyPastDay('2026-10-13', '2026-10-14', make({ 5: 'b' }))).toBe(false);
  });

  it('is false for today and future days', () => {
    expect(isEmptyPastDay('2026-10-14', '2026-10-14', blank)).toBe(false);
    expect(isEmptyPastDay('2026-10-15', '2026-10-14', undefined)).toBe(false);
  });
});
