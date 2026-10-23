import { describe, expect, it } from 'vitest';
import { emptySlots } from '../lib/entries';
import type { DayDoc, Entry } from '../types';
import {
  buildEntry,
  createForm,
  defaultStartFor,
  describeRange,
  defaultLengthFor,
  durationOptions,
  editForm,
  formatDuration,
  formatEntryRange,
  maxLengthFor,
  planSave,
  startOptions,
} from './logSheetLogic';

const sleep = { start: '23:00', end: '07:00' };
const tz = 'America/Los_Angeles';
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('defaultStartFor', () => {
  it('uses the previous full hour when viewing today', () => {
    expect(defaultStartFor('2026-10-14', at(2026, 10, 14, 14, 20))).toEqual({
      date: '2026-10-14',
      startSlot: 26,
    });
  });
  it('uses yesterday 23:00 just after midnight', () => {
    expect(defaultStartFor('2026-10-14', at(2026, 10, 14, 0, 20))).toEqual({
      date: '2026-10-13',
      startSlot: 46,
    });
  });
  it('uses 09:00 on a past day', () => {
    expect(defaultStartFor('2026-10-10', at(2026, 10, 14, 14, 20))).toEqual({
      date: '2026-10-10',
      startSlot: 18,
    });
  });
});

describe('options and formatting', () => {
  it('has 48 start options and 48 durations from 0:30 to 24:00', () => {
    const starts = startOptions();
    expect(starts).toHaveLength(48);
    expect(starts[0].label).toBe('00:00');
    expect(starts[47].label).toBe('23:30');
    const durations = durationOptions();
    expect(durations).toHaveLength(48);
    expect(durations[0]).toEqual({ value: 1, label: '0:30' });
    expect(durations[47]).toEqual({ value: 48, label: '24:00' });
  });
  it('formats durations', () => {
    expect(formatDuration(2)).toBe('1:00');
    expect(formatDuration(3)).toBe('1:30');
  });
  it('describes ranges, flagging midnight crossings', () => {
    expect(describeRange(26, 2)).toEqual({ text: '13:00–14:00', crossesMidnight: false });
    expect(describeRange(46, 2)).toEqual({ text: '23:00–24:00', crossesMidnight: false });
    expect(describeRange(46, 4)).toEqual({ text: '23:00–01:00', crossesMidnight: true });
  });
});

describe('defaultLengthFor', () => {
  const D = '2026-10-14';
  it('allows 1h when the second half-hour has started', () => {
    expect(defaultLengthFor('2026-10-14', 46, at(2026, 10, 14, 23, 31))).toBe(2);
  });
  it('clamps to the current slot when only the first half-hour has started', () => {
    expect(defaultLengthFor('2026-10-14', 46, at(2026, 10, 14, 23, 10))).toBe(1);
    expect(defaultLengthFor(D, 28, at(2026, 10, 14, 14, 20))).toBe(1);
  });
  it('allows 1h for an earlier hour today', () => {
    expect(defaultLengthFor(D, 26, at(2026, 10, 14, 14, 20))).toBe(2);
  });
  it('never goes below 1', () => {
    expect(defaultLengthFor(D, 30, at(2026, 10, 14, 14, 20))).toBe(1);
    expect(defaultLengthFor('2026-10-15', 0, at(2026, 10, 14, 14, 20))).toBe(1);
  });
  it('does not clamp past days', () => {
    expect(defaultLengthFor('2026-10-10', 46, at(2026, 10, 14, 0, 5))).toBe(2);
    expect(maxLengthFor('2026-10-10', 46, at(2026, 10, 14, 0, 5))).toBe(48);
  });
  it('counts slots up to and including the current one', () => {
    expect(maxLengthFor(D, 20, at(2026, 10, 14, 14, 20))).toBe(9);
  });
});

describe('forms', () => {
  it('creates a 1h form without a category', () => {
    expect(createForm({ date: '2026-10-14', startSlot: 26 }, at(2026, 10, 14, 14, 20))).toEqual({
      date: '2026-10-14',
      startSlot: 26,
      length: 2,
      note: '',
      category: null,
    });
  });
  it('builds entries, trimming blank notes', () => {
    const f = {
      ...createForm({ date: '2026-10-14', startSlot: 26 }, at(2026, 10, 14, 14, 20)),
      note: '  ',
    };
    expect(buildEntry(f, 'g')).toEqual({
      date: '2026-10-14',
      startSlot: 26,
      length: 2,
      category: 'g',
    });
    expect(buildEntry({ ...f, note: ' walk ' }, 'r').note).toBe('walk');
    expect(buildEntry(f, 'p').category).toBe('p');
  });
  it('round-trips an entry through the edit form', () => {
    const e: Entry = { date: '2026-10-14', startSlot: 4, length: 3, category: 'b', note: 'x' };
    expect(buildEntry(editForm(e), 'b')).toEqual(e);
  });
});

describe('planSave', () => {
  const now = at(2026, 10, 14, 14, 20);
  const entry: Entry = { date: '2026-10-14', startSlot: 26, length: 2, category: 'g' };

  it('rejects future entries', () => {
    const plan = planSave({ days: {}, entry: { ...entry, startSlot: 30 }, now, sleep, tz });
    expect(plan.ok).toBe(false);
  });
  it('plans a new day doc with the current sleep window', () => {
    const plan = planSave({ days: {}, entry, now, sleep, tz });
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.conflicts).toBe(0);
    expect(plan.changed['2026-10-14'].slots.slice(26, 28)).toBe('gg');
    expect(plan.changed['2026-10-14'].sleep).toEqual(sleep);
  });
  it('counts overwritten half-hours but not the entry being edited', () => {
    const doc: DayDoc = {
      slots: emptySlots().slice(0, 24) + 'rrrr' + emptySlots().slice(28),
      notes: {},
      sleep,
      tz,
      v: 1,
    };
    const days = { '2026-10-14': doc };
    const overwrite = planSave({
      days,
      entry: { ...entry, startSlot: 24, length: 4 },
      now,
      sleep,
      tz,
    });
    expect(overwrite.ok && overwrite.conflicts).toBe(4);
    const original: Entry = { date: '2026-10-14', startSlot: 24, length: 4, category: 'r' };
    const edit = planSave({ days, entry, original, now, sleep, tz });
    expect(edit.ok && edit.conflicts).toBe(0);
    expect(edit.ok && edit.changed['2026-10-14'].slots.slice(24, 28)).toBe('..gg');
  });
});

describe('formatEntryRange', () => {
  const entry: Entry = { date: '2026-10-15', startSlot: 46, length: 4, category: 'b' };
  it('names the next day for an entry continuing past midnight', () => {
    expect(formatEntryRange(entry, '2026-10-15')).toBe('23:00 – Fri 01:00');
  });
  it('names the start day for an entry that began the day before', () => {
    expect(formatEntryRange(entry, '2026-10-16')).toBe('Thu 23:00 – 01:00');
  });
  it('uses the plain range within one day', () => {
    expect(formatEntryRange({ ...entry, startSlot: 26, length: 2 }, '2026-10-15')).toBe(
      '13:00–14:00',
    );
    expect(formatEntryRange({ ...entry, length: 2 }, '2026-10-15')).toBe('23:00–24:00');
  });
});

describe('planSave with a midnight-crossing original', () => {
  const now = at(2026, 10, 20, 12);
  const doc = (slots: string, notes: Record<string, string> = {}): DayDoc => ({
    slots,
    notes,
    sleep,
    tz,
    v: 1,
  });
  const days = {
    '2026-10-14': doc('.'.repeat(46) + 'bb', { '46': 'x' }),
    '2026-10-15': doc('bb' + '.'.repeat(46), { '0': 'x' }),
  };
  const original: Entry = {
    date: '2026-10-14',
    startSlot: 46,
    length: 4,
    category: 'b',
    note: 'x',
  };

  it('edits the category across both days without conflicts', () => {
    const plan = planSave({
      days,
      entry: { ...original, category: 'g' },
      original,
      now,
      sleep,
      tz,
    });
    expect(plan).toMatchObject({ ok: true, conflicts: 0 });
    if (plan.ok) {
      expect(plan.changed['2026-10-14'].slots.slice(44)).toBe('..gg');
      expect(plan.changed['2026-10-15'].slots.slice(0, 4)).toBe('gg..');
    }
  });
});
