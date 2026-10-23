import { describe, expect, it } from 'vitest';
import type { DateKey, DayDoc, Entry, SlotRef } from '../../types';
import {
  applyEntry,
  deleteEntry,
  emptySlots,
  entriesFromDay,
  entriesOf,
  entryAt,
  findConflicts,
  logicalEntriesForDay,
  logicalEntryAt,
  normalizeBreaks,
  planDrop,
  undoDrop,
} from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const TZ = 'America/Los_Angeles';
const OPTS = { sleep: SLEEP, tz: TZ };
const D0 = '2026-06-09';
const D1 = '2026-06-10';
const D2 = '2026-06-11';
const NOW = new Date(2026, 5, 10, 18, 20);

type Days = Record<DateKey, DayDoc | undefined>;

const str = (set: Record<number, string>): string => {
  const a = emptySlots().split('');
  for (const [i, c] of Object.entries(set)) a[Number(i)] = c;
  return a.join('');
};
const run = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));
const marks = (...at: number[]): string => str(Object.fromEntries(at.map((i) => [i, '|'])));

const doc = (
  set: Record<number, string> = {},
  notes: Record<string, string> = {},
  breaks?: string,
): DayDoc => ({
  slots: str(set),
  notes,
  ...(breaks === undefined ? {} : { breaks }),
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

const refs = (date: DateKey, ...slots: number[]): SlotRef[] =>
  slots.map((slot) => ({ date, slot }));
const merge = (days: Days, changed: Days): Days => ({ ...days, ...changed });
const drop = (days: Days, targets: SlotRef[], category: Entry['category'], now = NOW) =>
  planDrop({ days, targets, category, sleep: SLEEP, tz: TZ, now });
/** Applies an entry and returns the merged days map, like the app does after a write. */
const put = (days: Days, entry: Entry, replace?: Entry): Days =>
  merge(days, applyEntry(days, entry, replace ? { ...OPTS, replace } : OPTS));

describe('normalizeBreaks', () => {
  it('returns undefined for missing, empty or all-dot masks', () => {
    expect(normalizeBreaks(str(run(4, 8, 'g')))).toBeUndefined();
    expect(normalizeBreaks(str(run(4, 8, 'g')), '')).toBeUndefined();
    expect(normalizeBreaks(str(run(4, 8, 'g')), emptySlots())).toBeUndefined();
  });

  it('keeps a mark where the previous slot has the same category', () => {
    expect(normalizeBreaks(str(run(4, 8, 'g')), marks(6))).toBe(marks(6));
    expect(normalizeBreaks(str(run(4, 8, 'g')), marks(5, 6, 7))).toBe(marks(5, 6, 7));
  });

  it('drops a mark between different categories, after a gap, or on a gap', () => {
    const slots = str({ 4: 'g', 5: 'b', 7: 'b', 8: 'b' });
    expect(normalizeBreaks(slots, marks(5, 7, 6, 9, 20))).toBeUndefined();
    expect(normalizeBreaks(slots, marks(5, 8))).toBe(marks(8));
  });

  it('keeps slot 0 whenever slot 0 is logged, and drops it otherwise', () => {
    expect(normalizeBreaks(str({ 0: 'r' }), marks(0))).toBe(marks(0));
    expect(normalizeBreaks(str({ 1: 'r' }), marks(0))).toBeUndefined();
  });

  it('tolerates junk: wrong length, other chars, whitespace', () => {
    const slots = str(run(0, 4, 'g'));
    expect(normalizeBreaks(slots, '|')).toBe(marks(0));
    expect(normalizeBreaks(slots, 'x|x|' + '.'.repeat(60))).toBe(marks(1, 3));
    expect(normalizeBreaks(slots, '.'.repeat(10))).toBeUndefined();
    expect(normalizeBreaks(slots, marks(2) + '||||||')).toBe(marks(2));
  });

  it('returns exactly 48 chars', () => {
    expect(normalizeBreaks(str(run(0, 4, 'g')), marks(2))).toHaveLength(48);
  });
});

describe('entriesOf / entriesFromDay / entryAt with breaks', () => {
  it('splits a same-category run at each valid mark', () => {
    expect(entriesOf(str(run(26, 32, 'g')), marks(28, 30))).toEqual([
      { start: 26, length: 2, category: 'g' },
      { start: 28, length: 2, category: 'g' },
      { start: 30, length: 2, category: 'g' },
    ]);
  });

  it('without a mask behaves like merged runs', () => {
    expect(entriesOf(str(run(26, 32, 'g')))).toEqual([{ start: 26, length: 6, category: 'g' }]);
  });

  it('ignores marks that are not meaningful', () => {
    const slots = str({ ...run(26, 28, 'g'), ...run(28, 30, 'b') });
    expect(entriesOf(slots, marks(28, 40, 20))).toHaveLength(2);
  });

  it('a mark at slot 0 does not change segmentation', () => {
    expect(entriesOf(str(run(0, 4, 'g')), marks(0))).toEqual([
      { start: 0, length: 4, category: 'g' },
    ]);
  });

  it('puts notes on entry starts and ignores them elsewhere', () => {
    const d = doc(run(26, 32, 'g'), { '26': 'a', '28': 'b', '31': 'stray' }, marks(28, 30));
    expect(entriesFromDay(D1, d)).toEqual([
      e(D1, 26, 2, 'g', 'a'),
      e(D1, 28, 2, 'g', 'b'),
      e(D1, 30, 2, 'g'),
    ]);
  });

  it('entryAt finds the entry, not the whole run', () => {
    const d = doc(run(26, 32, 'g'), { '28': 'b' }, marks(28));
    expect(entryAt(D1, d, 27)).toEqual(e(D1, 26, 2, 'g'));
    expect(entryAt(D1, d, 28)).toEqual(e(D1, 28, 4, 'g', 'b'));
    expect(entryAt(D1, d, 31)).toEqual(e(D1, 28, 4, 'g', 'b'));
  });
});

describe('applyEntry writes boundaries', () => {
  it('writes no field when no mark is meaningful (byte-identical to the old shape)', () => {
    const out = applyEntry({}, e(D1, 26, 3, 'g', 'focus'), OPTS)[D1]!;
    expect('breaks' in out).toBe(false);
    expect(out).toEqual({
      slots: str(run(26, 29, 'g')),
      notes: { '26': 'focus' },
      sleep: SLEEP,
      tz: TZ,
      v: 1,
    });
  });

  it('marks the start of an entry that follows a same-category entry, and the slot after its end', () => {
    const days = { [D1]: doc(run(26, 28, 'g')) };
    const out = applyEntry(days, e(D1, 28, 2, 'g'), OPTS)[D1]!;
    expect(out.breaks).toBe(marks(28));
    const both = merge(days, { [D1]: out });
    const after = applyEntry(both, e(D1, 24, 2, 'g'), OPTS)[D1]!;
    expect(after.breaks).toBe(marks(26, 28));
  });

  it('marks the slot after the end when a same-category entry follows', () => {
    const days = { [D1]: doc(run(30, 32, 'g')) };
    expect(applyEntry(days, e(D1, 28, 2, 'g'), OPTS)[D1]!.breaks).toBe(marks(30));
  });

  it('three adjacent entries are three lines', () => {
    let days: Days = {};
    days = put(days, e(D1, 26, 2, 'g', 'a'));
    days = put(days, e(D1, 28, 2, 'g', 'b'));
    days = put(days, e(D1, 30, 2, 'g', 'c'));
    expect(days[D1]!.slots).toBe(str(run(26, 32, 'g')));
    expect(days[D1]!.breaks).toBe(marks(28, 30));
    expect(entriesFromDay(D1, days[D1])).toEqual([
      e(D1, 26, 2, 'g', 'a'),
      e(D1, 28, 2, 'g', 'b'),
      e(D1, 30, 2, 'g', 'c'),
    ]);
  });

  it('keeps an existing legacy entry (no marks) a single line until something is applied next to it', () => {
    const days = { [D1]: doc(run(26, 32, 'g')) };
    expect(entriesFromDay(D1, days[D1])).toHaveLength(1);
  });

  it('an entry starting at slot 0 carries a slot-0 mark (do not join yesterday)', () => {
    const out = applyEntry({}, e(D1, 0, 2, 'g'), OPTS);
    expect(out[D1]!.breaks).toBe(marks(0));
  });

  it('a midnight-crossing entry marks its start, clears slot 0 on the next day, and marks the slot after the end', () => {
    const days = { [D2]: doc(run(0, 6, 'b'), {}, marks(0, 3)) };
    const out = applyEntry(days, e(D1, 46, 6, 'b', 'x'), OPTS);
    expect(out[D1]!.breaks).toBeUndefined();
    expect(out[D2]!.breaks).toBe(marks(4));
    const crossing = applyEntry({}, e(D1, 46, 4, 'g'), OPTS);
    expect(crossing[D1]!.breaks).toBeUndefined();
    expect(crossing[D2]!.breaks).toBeUndefined();
  });

  it('a crossing entry followed by a same-category entry on the next day marks the boundary', () => {
    const days = { [D2]: doc(run(2, 4, 'g')) };
    const out = applyEntry(days, e(D1, 46, 4, 'g'), OPTS);
    expect(out[D2]!.breaks).toBe(marks(2));
  });

  it('an entry ending at 24:00 marks the next day slot 0 when it is logged, in the same changed set', () => {
    const days = { [D2]: doc(run(0, 2, 'g'), { '0': 'next' }) };
    const out = applyEntry(days, e(D1, 44, 4, 'g'), OPTS);
    expect(Object.keys(out).sort()).toEqual([D1, D2]);
    expect(out[D2]!.breaks).toBe(marks(0));
    expect(out[D2]!.notes).toEqual({ '0': 'next' });
    expect(out[D2]!.slots).toBe(days[D2].slots);
  });

  it('does not touch the next day when slot 0 is not logged or the doc is missing', () => {
    expect(Object.keys(applyEntry({}, e(D1, 44, 4, 'g'), OPTS))).toEqual([D1]);
    const days = { [D2]: doc(run(2, 4, 'g')) };
    expect(Object.keys(applyEntry(days, e(D1, 44, 4, 'g'), OPTS))).toEqual([D1]);
  });

  it('does not rewrite the next day when it already has the slot-0 mark', () => {
    const days = { [D2]: doc(run(0, 2, 'g'), {}, marks(0)) };
    expect(Object.keys(applyEntry(days, e(D1, 44, 4, 'g'), OPTS))).toEqual([D1]);
  });

  it('a full-day entry from 00:00 marks slot 0 and the next day slot 0', () => {
    const days = { [D2]: doc(run(0, 2, 'r')) };
    const out = applyEntry(days, e(D1, 0, 48, 'g'), OPTS);
    expect(out[D1]!.breaks).toBe(marks(0));
    expect(out[D2]!.breaks).toBe(marks(0));
  });

  it('clears marks inside the written range', () => {
    const days = { [D1]: doc(run(20, 32, 'g'), {}, marks(24, 26, 28, 30)) };
    const out = applyEntry(days, e(D1, 24, 6, 'g'), OPTS)[D1]!;
    expect(out.breaks).toBe(marks(24, 30));
  });

  it('removes marks that become redundant when a different category lands next to them', () => {
    const days = { [D1]: doc(run(26, 30, 'g'), {}, marks(28)) };
    const out = applyEntry(days, e(D1, 28, 2, 'b'), OPTS)[D1]!;
    expect(out.slots).toBe(str({ ...run(26, 28, 'g'), ...run(28, 30, 'b') }));
    expect(out.breaks).toBeUndefined();
  });

  it('sanitizes stale junk on write', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), {}, marks(10, 27, 40)) };
    expect(applyEntry(days, e(D1, 2, 1, 'b'), OPTS)[D1]!.breaks).toBe(marks(27));
  });

  it('a note on a later entry stays when an earlier same-category entry is edited', () => {
    let days: Days = {};
    days = put(days, e(D1, 26, 2, 'g', 'a'));
    days = put(days, e(D1, 28, 2, 'g', 'b'));
    days = put(days, e(D1, 26, 2, 'g', 'a2'), e(D1, 26, 2, 'g', 'a'));
    expect(days[D1]!.notes).toEqual({ '26': 'a2', '28': 'b' });
    expect(days[D1]!.breaks).toBe(marks(28));
  });
});

describe('edit and delete with boundaries', () => {
  const lines = (): Days => {
    let days: Days = {};
    days = put(days, e(D1, 26, 2, 'g', 'a'));
    days = put(days, e(D1, 28, 2, 'g', 'b'));
    days = put(days, e(D1, 30, 2, 'g', 'c'));
    return days;
  };

  it('deleting the middle entry leaves the others and drops the mark that became a gap', () => {
    const out = deleteEntry(lines(), e(D1, 28, 2, 'g', 'b'));
    expect(out[D1]!.slots).toBe(str({ ...run(26, 28, 'g'), ...run(30, 32, 'g') }));
    expect(out[D1]!.breaks).toBeUndefined();
    expect(out[D1]!.notes).toEqual({ '26': 'a', '30': 'c' });
  });

  it('deleting the first entry keeps the second as its own entry', () => {
    const out = deleteEntry(lines(), e(D1, 26, 2, 'g', 'a'));
    expect(out[D1]!.breaks).toBe(marks(30));
    expect(entriesFromDay(D1, out[D1])).toEqual([e(D1, 28, 2, 'g', 'b'), e(D1, 30, 2, 'g', 'c')]);
  });

  it('deleting the last entry keeps the others split', () => {
    const out = deleteEntry(lines(), e(D1, 30, 2, 'g', 'c'));
    expect(out[D1]!.breaks).toBe(marks(28));
    expect(entriesFromDay(D1, out[D1])).toHaveLength(2);
  });

  it('deleting every entry leaves no field', () => {
    let days = lines();
    for (const entry of entriesFromDay(D1, days[D1])) days = merge(days, deleteEntry(days, entry));
    expect(days[D1]!.slots).toBe(emptySlots());
    expect('breaks' in days[D1]!).toBe(false);
  });

  it('editing the note of a middle entry changes only that note', () => {
    const base = lines();
    const out = applyEntry(base, e(D1, 28, 2, 'g', 'B2'), {
      ...OPTS,
      replace: e(D1, 28, 2, 'g', 'b'),
    });
    expect(out[D1]!.notes).toEqual({ '26': 'a', '28': 'B2', '30': 'c' });
    expect(out[D1]!.breaks).toBe(marks(28, 30));
  });

  it('changing the category of a middle entry leaves no redundant marks', () => {
    const out = applyEntry(lines(), e(D1, 28, 2, 'r', 'b'), {
      ...OPTS,
      replace: e(D1, 28, 2, 'g', 'b'),
    });
    expect(out[D1]!.slots).toBe(
      str({ ...run(26, 28, 'g'), ...run(28, 30, 'r'), ...run(30, 32, 'g') }),
    );
    expect(out[D1]!.breaks).toBeUndefined();
  });

  it('lengthening a middle entry over its neighbour keeps both edges', () => {
    const out = applyEntry(lines(), e(D1, 28, 3, 'g', 'b'), {
      ...OPTS,
      replace: e(D1, 28, 2, 'g', 'b'),
    });
    expect(out[D1]!.breaks).toBe(marks(28, 31));
    expect(entriesFromDay(D1, out[D1]).map((x) => [x.startSlot, x.length])).toEqual([
      [26, 2],
      [28, 3],
      [31, 1],
    ]);
  });

  it('moving an entry across midnight clears the old line and marks the new one', () => {
    const out = applyEntry(lines(), e(D1, 46, 4, 'g', 'b'), {
      ...OPTS,
      replace: e(D1, 28, 2, 'g', 'b'),
    });
    expect(out[D1]!.slots).toBe(
      str({ ...run(26, 28, 'g'), ...run(30, 32, 'g'), ...run(46, 48, 'g') }),
    );
    expect(out[D1]!.breaks).toBeUndefined();
    expect(out[D2]!.breaks).toBeUndefined();
  });

  it('deleting a crossing entry also removes its marks on both days', () => {
    const created = applyEntry({}, e(D1, 46, 4, 'b', 'n'), OPTS);
    const out = deleteEntry(created, e(D1, 46, 4, 'b'));
    expect('breaks' in out[D1]!).toBe(false);
    expect('breaks' in out[D2]!).toBe(false);
  });

  it('findConflicts treats an adjacent same-category entry as separate', () => {
    const days = lines();
    expect(findConflicts(days, e(D1, 26, 4), e(D1, 26, 2))).toEqual([
      { date: D1, slot: 28 },
      { date: D1, slot: 29 },
    ]);
    expect(findConflicts(days, e(D1, 26, 2), e(D1, 26, 2))).toEqual([]);
  });

  it('does not mutate its input', () => {
    const days = lines();
    const copy = structuredClone(days);
    Object.freeze(days[D1]);
    Object.freeze(days);
    applyEntry(days, e(D1, 28, 3, 'g'), { ...OPTS, replace: e(D1, 28, 2, 'g') });
    deleteEntry(days, e(D1, 28, 2, 'g'));
    expect(days).toEqual(copy);
  });

  it('a no-op replace changes nothing even with marks', () => {
    const days = lines();
    expect(
      applyEntry(days, e(D1, 28, 2, 'g', 'b'), { ...OPTS, replace: e(D1, 28, 2, 'g', 'b') }),
    ).toEqual({});
  });
});

describe('midnight joins respect the next-day mark', () => {
  const tail = doc(run(46, 48, 'b'), { '46': 'late' });

  it('joins when the next day has no mark (legacy docs)', () => {
    const days = { [D1]: tail, [D2]: doc(run(0, 2, 'b'), { '0': 'x' }) };
    expect(logicalEntryAt(days, D1, 47)).toEqual(e(D1, 46, 4, 'b', 'late · x'));
  });

  it('does not join when the next day has a slot-0 mark', () => {
    const days = { [D1]: tail, [D2]: doc(run(0, 2, 'b'), { '0': 'x' }, marks(0)) };
    expect(logicalEntryAt(days, D1, 47)).toEqual(e(D1, 46, 2, 'b', 'late'));
    expect(logicalEntryAt(days, D2, 0)).toEqual(e(D2, 0, 2, 'b', 'x'));
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 46, 2, 'b', 'late')]);
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D2, 0, 2, 'b', 'x')]);
  });

  it('a mark at slot 0 on a day with an empty slot 0 is ignored', () => {
    const days = { [D1]: tail, [D2]: doc(run(2, 4, 'b'), {}, marks(0)) };
    expect(logicalEntryAt(days, D1, 47)).toEqual(e(D1, 46, 2, 'b', 'late'));
  });

  it('joins only the head entry of the next day, not later same-category entries', () => {
    const days = {
      [D1]: tail,
      [D2]: doc(run(0, 6, 'b'), {}, marks(2)),
    };
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D1, 46, 4, 'b', 'late'), e(D2, 2, 4, 'b')]);
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 46, 4, 'b', 'late')]);
  });

  it('a tail that is one of several same-category entries on its day still joins', () => {
    const d1 = doc(run(40, 48, 'b'), {}, marks(46));
    const days = { [D1]: d1, [D2]: doc(run(0, 2, 'b')) };
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 40, 6, 'b'), e(D1, 46, 4, 'b')]);
  });

  it('a crossing entry written by applyEntry stays one joined line', () => {
    const days = put({}, e(D1, 46, 4, 'g', 'x'));
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 46, 4, 'g', 'x')]);
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D1, 46, 4, 'g', 'x')]);
  });

  it('two entries either side of midnight are two lines when applied separately', () => {
    let days: Days = {};
    days = put(days, e(D1, 44, 4, 'g', 'before'));
    days = put(days, e(D2, 0, 4, 'g', 'after'));
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 44, 4, 'g', 'before')]);
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D2, 0, 4, 'g', 'after')]);
  });

  it('applying the earlier-day entry after the later one also keeps two lines', () => {
    let days: Days = {};
    days = put(days, e(D2, 0, 4, 'g', 'after'));
    days = put(days, e(D1, 44, 4, 'g', 'before'));
    expect(days[D2]!.breaks).toBe(marks(0));
    expect(logicalEntriesForDay(days, D1)).toEqual([e(D1, 44, 4, 'g', 'before')]);
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D2, 0, 4, 'g', 'after')]);
  });

  it('editing the joined line moves both parts and keeps it joined', () => {
    const days = put({}, e(D1, 46, 4, 'g', 'x'));
    const joined = logicalEntryAt(days, D1, 46)!;
    const out = applyEntry(days, { ...joined, category: 'b' }, { ...OPTS, replace: joined });
    expect(out[D1]!.slots).toBe(str(run(46, 48, 'b')));
    expect(out[D2]!.slots).toBe(str(run(0, 2, 'b')));
    expect('breaks' in out[D1]!).toBe(false);
    expect('breaks' in out[D2]!).toBe(false);
  });

  it('a mark does not join a different-category tail either way', () => {
    const days = { [D1]: tail, [D2]: doc(run(0, 2, 'g'), {}, marks(0)) };
    expect(logicalEntriesForDay(days, D2)).toEqual([e(D2, 0, 2, 'g')]);
  });
});

describe('purposeful entries', () => {
  it('a break inside a p run splits it into two p entries', () => {
    const d = doc(run(26, 32, 'p'), { '26': 'a', '30': 'c' }, marks(30));
    expect(entriesFromDay(D1, d)).toEqual([e(D1, 26, 4, 'p', 'a'), e(D1, 30, 2, 'p', 'c')]);
    expect(entriesOf(d.slots, d.breaks)).toEqual([
      { start: 26, length: 4, category: 'p' },
      { start: 30, length: 2, category: 'p' },
    ]);
    expect(normalizeBreaks(d.slots, d.breaks)).toBe(marks(30));
  });

  it('a p entry next to a g entry needs no break mark', () => {
    const out = applyEntry({ [D1]: doc(run(26, 28, 'p')) }, e(D1, 28, 2, 'g'), OPTS)[D1]!;
    expect(out.slots).toBe(str({ ...run(26, 28, 'p'), ...run(28, 30, 'g') }));
    expect(out.breaks).toBeUndefined();
  });

  it('drop then undo restores p slots, notes and breaks', () => {
    const days = { [D1]: doc(run(26, 32, 'p'), { '26': 'a', '30': 'c' }, marks(30)) };
    const plan = drop(days, refs(D1, 28, 29), 'g');
    expect(plan.changed[D1]!.slots).toBe(
      str({ ...run(26, 28, 'p'), ...run(28, 30, 'g'), ...run(30, 32, 'p') }),
    );
    expect(plan.undo.slots).toEqual([
      { date: D1, slot: 28, prev: 'p' },
      { date: D1, slot: 29, prev: 'p' },
    ]);
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[D1]).toEqual(days[D1]);
  });

  it('dropping p over g and undoing restores g', () => {
    const days = { [D1]: doc(run(26, 30, 'g')) };
    const plan = drop(days, refs(D1, 27, 28), 'p');
    expect(plan.changed[D1]!.slots).toBe(
      str({ ...run(26, 27, 'g'), ...run(27, 29, 'p'), 29: 'g' }),
    );
    expect(undoDrop(merge(days, plan.changed), plan.undo)[D1]).toEqual(days[D1]);
  });
});

describe('planDrop and undoDrop with boundaries', () => {
  it('each drop is its own entry (catch-up drops show as two lines)', () => {
    const first = drop({}, refs(D1, 26, 27), 'g');
    let days = merge({}, first.changed);
    const second = drop(days, refs(D1, 28, 29), 'g');
    days = merge(days, second.changed);
    expect(days[D1]!.slots).toBe(str(run(26, 30, 'g')));
    expect(days[D1]!.breaks).toBe(marks(28));
    expect(entriesFromDay(D1, days[D1]).map((x) => [x.startSlot, x.length])).toEqual([
      [26, 2],
      [28, 2],
    ]);
  });

  it('records the changed mask chars for undo', () => {
    const days = { [D1]: doc(run(26, 28, 'g')) };
    const plan = drop(days, refs(D1, 28, 29), 'g');
    expect(plan.undo.breaks).toEqual([{ date: D1, slot: 28, prev: '.', next: '|' }]);
  });

  it('records nothing for the mask when none changes', () => {
    const plan = drop({}, refs(D1, 26, 27), 'g');
    expect(plan.undo.breaks).toEqual([]);
    expect('breaks' in plan.changed[D1]!).toBe(false);
  });

  it('records prior marks that the drop removes', () => {
    const days = { [D1]: doc(run(26, 30, 'g'), {}, marks(28)) };
    const plan = drop(days, refs(D1, 28), 'b');
    expect(plan.undo.breaks).toContainEqual({ date: D1, slot: 28, prev: '|', next: '.' });
    expect(undoDrop(merge(days, plan.changed), plan.undo)[D1]).toEqual(days[D1]);
  });

  it('undo restores slots and breaks exactly (round trip)', () => {
    const days = { [D1]: doc(run(26, 32, 'g'), { '26': 'a', '30': 'c' }, marks(30)) };
    const plan = drop(days, refs(D1, 28, 29), 'b');
    expect(plan.noop).toBe(false);
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[D1]).toEqual(days[D1]);
  });

  it('undoing the second catch-up drop leaves the first as it was', () => {
    const first = drop({}, refs(D1, 26, 27), 'g');
    const afterFirst = merge({}, first.changed);
    const second = drop(afterFirst, refs(D1, 28, 29), 'g');
    const undone = undoDrop(merge(afterFirst, second.changed), second.undo);
    expect(undone[D1]).toEqual(afterFirst[D1]);
    expect(undone[D1]!.breaks).toBeUndefined();
  });

  it('undoing the first drop after the second keeps the second as its own line', () => {
    const first = drop({}, refs(D1, 26, 27), 'g');
    const afterFirst = merge({}, first.changed);
    const second = drop(afterFirst, refs(D1, 28, 29), 'g');
    const afterSecond = merge(afterFirst, second.changed);
    const undone = undoDrop(afterSecond, first.undo);
    expect(undone[D1]!.slots).toBe(str(run(28, 30, 'g')));
    expect(entriesFromDay(D1, undone[D1])).toEqual([e(D1, 28, 2, 'g')]);
  });

  it('a drop of the same category onto a legacy merged run splits it, and undo re-merges it', () => {
    const days = { [D1]: doc(run(26, 32, 'g'), { '26': 'whole' }) };
    const plan = drop(days, refs(D1, 28, 29), 'b');
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[D1]).toEqual(days[D1]);
    expect(entriesFromDay(D1, undone[D1])).toHaveLength(1);
  });

  it('a midnight-crossing drop is one entry and undo restores both days', () => {
    const now = new Date(2026, 5, 10, 0, 20);
    const days = { [D0]: doc({ 46: 'b' }) };
    const plan = drop(days, [...refs(D0, 47), ...refs(D1, 0)], 'g', now);
    const days2 = merge(days, plan.changed);
    expect(logicalEntriesForDay(days2, D1)).toEqual([e(D0, 47, 2, 'g')]);
    expect(undoDrop(days2, plan.undo)[D0]).toEqual(days[D0]);
  });

  it('a drop ending at 24:00 marks the logged next day and undo clears it again', () => {
    const days = { [D2]: doc(run(0, 2, 'g')) };
    const plan = drop(days, refs(D1, 46, 47), 'g', new Date(2026, 5, 11, 12, 0));
    expect(plan.changed[D2]!.breaks).toBe(marks(0));
    expect(plan.undo.breaks).toContainEqual({ date: D2, slot: 0, prev: '.', next: '|' });
    const undone = undoDrop(merge(days, plan.changed), plan.undo);
    expect(undone[D2]).toEqual(days[D2]);
    expect(undone[D1]!.slots).toBe(emptySlots());
  });

  it('after an intervening edit it restores only what is still the drop, and stays valid', () => {
    const first = drop({}, refs(D1, 26, 27), 'g');
    const afterFirst = merge({}, first.changed);
    const second = drop(afterFirst, refs(D1, 28, 29), 'g');
    let days = merge(afterFirst, second.changed);
    // the user recolors the second line, then logs another g line right after it
    days = put(days, e(D1, 28, 2, 'r'), e(D1, 28, 2, 'g'));
    days = put(days, e(D1, 30, 2, 'g'));
    const undone = merge(days, undoDrop(days, second.undo));
    expect(undone[D1]!.slots).toBe(days[D1]!.slots);
    for (const d of Object.values(undone)) {
      expect(d!.breaks).toBe(normalizeBreaks(d!.slots, d!.breaks));
    }
  });

  it('does not clear a mark the user re-made on slots that no longer hold the drop', () => {
    const first = drop({}, refs(D1, 26, 27), 'g');
    const afterFirst = merge({}, first.changed);
    const second = drop(afterFirst, refs(D1, 28, 29), 'g');
    let days = merge(afterFirst, second.changed);
    days = put(days, e(D1, 26, 2, 'r'), e(D1, 26, 2, 'g'));
    days = put(days, e(D1, 28, 2, 'r'), e(D1, 28, 2, 'g'));
    expect(days[D1]!.breaks).toBe(marks(28));
    const undone = merge(days, undoDrop(days, second.undo));
    expect(undone[D1]).toEqual(days[D1]);
    expect(entriesFromDay(D1, undone[D1])).toHaveLength(2);
  });

  it('is a no-change when the marks and slots are already as they were', () => {
    const days = { [D1]: doc(run(26, 30, 'g'), {}, marks(28)) };
    const plan = drop(days, refs(D1, 28, 29), 'g');
    expect(plan.noop).toBe(true);
    expect(undoDrop(days, plan.undo)).toEqual({});
  });

  it('accepts an undo without a breaks list (older shape)', () => {
    const plan = drop({}, refs(D1, 26, 27), 'g');
    const legacy = { ...plan.undo } as Partial<typeof plan.undo>;
    delete legacy.breaks;
    const undone = undoDrop(plan.changed, legacy as typeof plan.undo);
    expect(undone[D1]!.slots).toBe(emptySlots());
  });
});
