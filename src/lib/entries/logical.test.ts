import { describe, expect, it } from 'vitest';
import type { DateKey, DayDoc, Entry } from '../../types';
import {
  applyEntry,
  deleteEntry,
  emptySlots,
  findConflicts,
  logicalEntriesForDay,
  logicalEntryAt,
  withReflection,
} from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const OPTS = { sleep: SLEEP, tz: 'UTC' };
const D0 = '2026-06-09';
const D1 = '2026-06-10';
const D2 = '2026-06-11';

const slotsOf = (set: Record<number, string>): string => {
  const a = emptySlots().split('');
  for (const [i, c] of Object.entries(set)) a[Number(i)] = c;
  return a.join('');
};
const run = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));

const doc = (set: Record<number, string> = {}, notes: Record<string, string> = {}): DayDoc => ({
  slots: slotsOf(set),
  notes,
  sleep: { start: '22:00', end: '06:00' },
  tz: 'UTC',
  v: 1,
});

const e = (
  date: DateKey,
  startSlot: number,
  length: number,
  category: Entry['category'] = 'g',
  note?: string,
): Entry =>
  note === undefined
    ? { date, startSlot, length, category }
    : { date, startSlot, length, category, note };

/** D1 22:00-24:00... 23:00–01:00 Wasted, note on both days like applyEntry writes. */
const crossing = (): Record<DateKey, DayDoc> => ({
  [D1]: doc(run(46, 48, 'b'), { '46': 'late' }),
  [D2]: doc(run(0, 2, 'b'), { '0': 'late' }),
});

describe('logicalEntryAt / logicalEntriesForDay', () => {
  it('joins a tail run with the next day head run, from either side', () => {
    const days = crossing();
    const joined = e(D1, 46, 4, 'b', 'late');
    expect(logicalEntryAt(days, D1, 47)).toEqual(joined);
    expect(logicalEntryAt(days, D2, 0)).toEqual(joined);
    expect(logicalEntryAt(days, D2, 1)).toEqual(joined);
    expect(logicalEntriesForDay(days, D1)).toEqual([joined]);
    expect(logicalEntriesForDay(days, D2)).toEqual([joined]);
  });

  it('uses the later day note when the earlier one has none', () => {
    const days = { [D1]: doc(run(46, 48, 'b')), [D2]: doc(run(0, 2, 'b'), { '0': 'x' }) };
    expect(logicalEntryAt(days, D1, 46)).toEqual(e(D1, 46, 4, 'b', 'x'));
  });

  it('has no note key when neither day has one', () => {
    const days = { [D1]: doc(run(46, 48, 'b')), [D2]: doc(run(0, 2, 'b')) };
    expect(logicalEntryAt(days, D1, 46)).toEqual(e(D1, 46, 4, 'b'));
  });

  it('does not join different categories', () => {
    const days = { [D1]: doc(run(46, 48, 'b')), [D2]: doc(run(0, 2, 'g')) };
    expect(logicalEntryAt(days, D1, 46)).toEqual(e(D1, 46, 2, 'b'));
    expect(logicalEntryAt(days, D2, 0)).toEqual(e(D2, 0, 2, 'g'));
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D2, 0, 2, 'g')]);
  });

  it('does not join when the combined length exceeds 48', () => {
    const days = { [D1]: doc(run(8, 48, 'g')), [D2]: doc(run(0, 10, 'g')) };
    expect(logicalEntryAt(days, D1, 20)).toEqual(e(D1, 8, 40, 'g'));
    expect(logicalEntryAt(days, D2, 0)).toEqual(e(D2, 0, 10, 'g'));
  });

  it('joins exactly 48 slots', () => {
    const days = { [D1]: doc(run(10, 48, 'g')), [D2]: doc(run(0, 10, 'g')) };
    expect(logicalEntryAt(days, D2, 3)).toEqual(e(D1, 10, 48, 'g'));
  });

  it('does not join when the next day is missing or has a gap at slot 0', () => {
    const days = { [D1]: doc(run(46, 48, 'b')), [D2]: doc(run(2, 4, 'b')) };
    expect(logicalEntryAt(days, D1, 46)).toEqual(e(D1, 46, 2, 'b'));
    expect(logicalEntryAt({ [D1]: days[D1] }, D1, 47)).toEqual(e(D1, 46, 2, 'b'));
    expect(logicalEntryAt({ [D2]: days[D2] }, D2, 2)).toEqual(e(D2, 2, 2, 'b'));
  });

  it('returns null for empty slots and keeps the middle entries plain', () => {
    const days = {
      [D1]: doc({ ...run(4, 6, 'r'), ...run(46, 48, 'b') }),
      [D2]: doc(run(0, 2, 'b')),
    };
    expect(logicalEntryAt(days, D1, 10)).toBeNull();
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 4, 2, 'r'), e(D1, 46, 4, 'b')]);
  });

  it('lists the previous day entry first, then the rest, in time order', () => {
    const days = {
      [D1]: doc(run(46, 48, 'b'), { '46': 'late' }),
      [D2]: doc({ ...run(0, 2, 'b'), ...run(10, 12, 'g'), ...run(46, 48, 'r') }),
      [D0]: doc(),
    };
    expect(logicalEntriesForDay(days, D2)).toEqual([
      e(D1, 46, 4, 'b', 'late'),
      e(D2, 10, 2, 'g'),
      e(D2, 46, 2, 'r'),
    ]);
  });

  it('does not join a full-day run with neighbours', () => {
    const days = { [D1]: doc(run(0, 48, 'g')), [D2]: doc(run(0, 2, 'g')) };
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 0, 48, 'g')]);
  });
});

describe('editing a joined entry', () => {
  const days = crossing();
  const joined = e(D1, 46, 4, 'b', 'late');

  it('finds no conflicts with itself across both days', () => {
    expect(findConflicts(days, joined, joined)).toEqual([]);
    expect(findConflicts(days, joined)).toHaveLength(4);
  });

  it('changes the category on both days', () => {
    const out = applyEntry(days, { ...joined, category: 'g' }, { ...OPTS, replace: joined });
    expect(out[D1]!.slots).toBe(slotsOf(run(46, 48, 'g')));
    expect(out[D2]!.slots).toBe(slotsOf(run(0, 2, 'g')));
    expect(out[D1]!.notes).toEqual({ '46': 'late' });
    expect(out[D2]!.notes).toEqual({ '0': 'late' });
  });

  it('moves it to another day, leaving no orphan slot-0 note', () => {
    const moved = e(D0, 46, 4, 'b', 'late');
    const out = applyEntry(days, moved, { ...OPTS, replace: joined });
    expect(out[D1]!.slots).toBe(slotsOf(run(0, 2, 'b')));
    expect(out[D2]!.slots).toBe(emptySlots());
    expect(out[D2]!.notes).toEqual({});
    expect(out[D0]!.slots).toBe(slotsOf(run(46, 48, 'b')));
    expect(out[D0]!.notes).toEqual({ '46': 'late' });
    expect(out[D1]!.notes).toEqual({ '0': 'late' });
  });

  it('shortens it so the later day is cleared', () => {
    const shorter = e(D1, 46, 2, 'b', 'late');
    const out = applyEntry(days, shorter, { ...OPTS, replace: joined });
    expect(out[D1]).toBeUndefined();
    expect(out[D2]).toMatchObject({ slots: emptySlots(), notes: {} });
  });

  it('drops the note when edited to none', () => {
    const out = applyEntry(days, e(D1, 46, 4, 'b'), { ...OPTS, replace: joined });
    expect(out[D1]!.notes).toEqual({});
    expect(out[D2]!.notes).toEqual({});
  });

  it('deletes both pieces and both notes', () => {
    const out = deleteEntry(days, joined);
    expect(out[D1]).toMatchObject({ slots: emptySlots(), notes: {} });
    expect(out[D2]).toMatchObject({ slots: emptySlots(), notes: {} });
  });

  it('deleting keeps other entries and their notes on the later day', () => {
    const more = {
      [D1]: days[D1],
      [D2]: doc({ ...run(0, 2, 'b'), ...run(10, 12, 'g') }, { '0': 'late', '10': 'keep' }),
    };
    const out = deleteEntry(more, joined);
    expect(out[D2]!.slots).toBe(slotsOf(run(10, 12, 'g')));
    expect(out[D2]!.notes).toEqual({ '10': 'keep' });
  });

  it('does not mutate its input', () => {
    const frozen = structuredClone(days);
    for (const d of Object.values(frozen)) {
      Object.freeze(d);
      Object.freeze(d.notes);
      Object.freeze(d.sleep);
    }
    Object.freeze(frozen);
    const before = structuredClone(frozen);
    applyEntry(frozen, { ...joined, category: 'r' }, { ...OPTS, replace: joined });
    deleteEntry(frozen, joined);
    logicalEntriesForDay(frozen, D2);
    expect(frozen).toEqual(before);
  });
});

describe('joined entries with differing notes', () => {
  it('keeps both notes when edited', () => {
    let days: Record<DateKey, DayDoc> = {};
    days = { ...days, ...applyEntry(days, e(D1, 46, 4, 'g', 'late'), OPTS) };
    days = { ...days, ...applyEntry(days, e(D2, 2, 2, 'g', 'extra'), OPTS) };
    const joined = logicalEntryAt(days, D1, 47)!;
    expect(joined.note).toBe('late · extra');
    const out = applyEntry(days, { ...joined, category: 'b' }, { ...OPTS, replace: joined });
    expect(out[D1]!.notes).toEqual({ '46': 'late · extra' });
    expect(out[D2]!.notes['0']).toBe('late · extra');
  });

  it('joins unrelated notes in time order and skips duplicates', () => {
    const days = {
      [D1]: doc(run(46, 48, 'b'), { '46': 'a' }),
      [D2]: doc(run(0, 2, 'b'), { '0': 'b' }),
    };
    expect(logicalEntryAt(days, D1, 46)!.note).toBe('a · b');
    days[D2] = doc(run(0, 2, 'b'), { '0': 'a' });
    expect(logicalEntryAt(days, D1, 46)!.note).toBe('a');
    days[D1] = doc(run(46, 48, 'b'));
    expect(logicalEntryAt(days, D1, 46)!.note).toBe('a');
  });

  it('truncates the combined note', () => {
    const days = {
      [D1]: doc(run(46, 48, 'b'), { '46': 'x'.repeat(150) }),
      [D2]: doc(run(0, 2, 'b'), { '0': 'y'.repeat(150) }),
    };
    expect(logicalEntryAt(days, D1, 46)!.note).toHaveLength(200);
  });
});

describe('reflection', () => {
  const o = { sleep: SLEEP, tz: 'Europe/Paris' };

  it('creates a doc when missing', () => {
    expect(withReflection(undefined, '  good day ', o)).toEqual({
      slots: emptySlots(),
      notes: {},
      sleep: SLEEP,
      tz: 'Europe/Paris',
      reflection: 'good day',
      v: 1,
    });
  });

  it('keeps slots, notes, sleep and tz of an existing doc', () => {
    const d = doc(run(4, 6, 'g'), { '4': 'x' });
    const out = withReflection(d, 'hi', o);
    expect(out).toEqual({ ...d, reflection: 'hi' });
    expect(out.sleep).toEqual(d.sleep);
    expect(out.tz).toBe('UTC');
  });

  it('removes the key for empty or whitespace text', () => {
    const d = { ...doc(), reflection: 'old' };
    expect('reflection' in withReflection(d, '', o)).toBe(false);
    expect('reflection' in withReflection(d, '   \n', o)).toBe(false);
    expect('reflection' in withReflection(undefined, '', o)).toBe(false);
  });

  it('truncates to 1000 characters', () => {
    expect(withReflection(undefined, 'a'.repeat(1500), o).reflection).toHaveLength(1000);
    expect(withReflection(undefined, 'a'.repeat(1000), o).reflection).toHaveLength(1000);
  });

  it('does not mutate the input', () => {
    const d = Object.freeze({ ...doc(), notes: Object.freeze({}) }) as DayDoc;
    const out = withReflection(d, 'x', o);
    expect(out).not.toBe(d);
    expect(d.reflection).toBeUndefined();
  });

  it('applyEntry and deleteEntry preserve reflection', () => {
    const d = { ...doc(run(10, 12, 'g')), reflection: 'keep me' };
    const days = { [D1]: d };
    expect(applyEntry(days, e(D1, 20, 2, 'b'), OPTS)[D1]!.reflection).toBe('keep me');
    expect(
      applyEntry(days, e(D1, 12, 2, 'r'), { ...OPTS, replace: e(D1, 10, 2, 'g') })[D1]!.reflection,
    ).toBe('keep me');
    expect(deleteEntry(days, e(D1, 10, 2, 'g'))[D1]!.reflection).toBe('keep me');
  });
});
