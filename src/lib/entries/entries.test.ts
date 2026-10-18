import { describe, expect, it } from 'vitest';
import type { DateKey, DayDoc, Entry } from '../../types';
import {
  applyEntry,
  deleteEntry,
  emptySlots,
  entriesFromDay,
  entryAt,
  findConflicts,
  validateEntry,
} from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const TZ = 'America/Los_Angeles';
const OPTS = { sleep: SLEEP, tz: TZ };
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

const clone = <T>(x: T): T => structuredClone(x);

describe('emptySlots', () => {
  it('is 48 dots', () => {
    expect(emptySlots()).toBe('.'.repeat(48));
    expect(emptySlots()).toHaveLength(48);
  });
});

describe('entriesFromDay / entryAt', () => {
  it('returns nothing for a missing or empty day', () => {
    expect(entriesFromDay(D1, undefined)).toEqual([]);
    expect(entriesFromDay(D1, doc())).toEqual([]);
  });
  it('finds maximal same-category runs with notes at run start', () => {
    const d = doc(
      { ...run(26, 29, 'g'), ...run(29, 31, 'b'), ...run(33, 34, 'r'), ...run(34, 36, 'g') },
      { '26': 'deep work', '33': 'oops' },
    );
    expect(entriesFromDay(D1, d)).toEqual([
      e(D1, 26, 3, 'g', 'deep work'),
      e(D1, 29, 2, 'b'),
      e(D1, 33, 1, 'r', 'oops'),
      e(D1, 34, 2, 'g'),
    ]);
  });
  it('a gap splits same-category runs', () => {
    const d = doc({ 2: 'g', 4: 'g' });
    expect(entriesFromDay(D1, d)).toHaveLength(2);
  });
  it('handles runs touching slot 0 and slot 47, and a full day', () => {
    expect(entriesFromDay(D1, doc(run(0, 2, 'b')))).toEqual([e(D1, 0, 2, 'b')]);
    expect(entriesFromDay(D1, doc(run(46, 48, 'r')))).toEqual([e(D1, 46, 2, 'r')]);
    expect(entriesFromDay(D1, doc(run(0, 48, 'g')))).toEqual([e(D1, 0, 48, 'g')]);
  });
  it('ignores empty-string notes', () => {
    expect(entriesFromDay(D1, doc({ 3: 'g' }, { '3': '' }))).toEqual([e(D1, 3, 1, 'g')]);
  });
  it('entryAt returns the run containing the slot', () => {
    const d = doc(run(10, 14, 'b'), { '10': 'n' });
    expect(entryAt(D1, d, 10)).toEqual(e(D1, 10, 4, 'b', 'n'));
    expect(entryAt(D1, d, 13)).toEqual(e(D1, 10, 4, 'b', 'n'));
    expect(entryAt(D1, d, 14)).toBeNull();
    expect(entryAt(D1, d, 9)).toBeNull();
    expect(entryAt(D1, undefined, 9)).toBeNull();
  });
});

describe('findConflicts', () => {
  const days = { [D1]: doc({ ...run(26, 28, 'g'), 47: 'b' }), [D2]: doc(run(0, 2, 'r')) };
  it('none on empty ranges and missing days', () => {
    expect(findConflicts(days, e(D1, 30, 4))).toEqual([]);
    expect(findConflicts({}, e(D1, 30, 4))).toEqual([]);
    expect(findConflicts({ [D1]: undefined }, e(D1, 30, 4))).toEqual([]);
  });
  it('lists logged slots in range', () => {
    expect(findConflicts(days, e(D1, 25, 4))).toEqual([
      { date: D1, slot: 26 },
      { date: D1, slot: 27 },
    ]);
  });
  it('detects conflicts across midnight', () => {
    expect(findConflicts(days, e(D1, 46, 4))).toEqual([
      { date: D1, slot: 47 },
      { date: D2, slot: 0 },
      { date: D2, slot: 1 },
    ]);
  });
  it('ignores slots of the entry being edited', () => {
    const orig = e(D1, 26, 2);
    expect(findConflicts(days, e(D1, 26, 4), orig)).toEqual([]);
    expect(findConflicts(days, e(D1, 27, 4), orig)).toEqual([]);
    expect(findConflicts(days, e(D1, 20, 8), orig)).toEqual([]);
  });
  it('still reports other entries when ignoring one', () => {
    expect(findConflicts(days, e(D1, 26, 22), e(D1, 26, 2))).toEqual([{ date: D1, slot: 47 }]);
  });
  it('ignores entries that cross midnight', () => {
    const orig = e(D1, 47, 3);
    expect(findConflicts(days, e(D1, 47, 3), orig)).toEqual([]);
    expect(findConflicts(days, e(D1, 46, 4), orig)).toEqual([]);
    expect(findConflicts(days, e(D1, 46, 4))).toHaveLength(3);
  });
  it('throws on an invalid entry', () => {
    expect(() => findConflicts(days, e(D1, 0, 0))).toThrow();
  });
});

describe('applyEntry (create)', () => {
  it('creates a new day doc with snapshot, tz, v and note', () => {
    const out = applyEntry({}, e(D1, 26, 3, 'g', 'focus'), OPTS);
    expect(Object.keys(out)).toEqual([D1]);
    expect(out[D1]).toEqual({
      slots: slotsOf(run(26, 29, 'g')),
      notes: { '26': 'focus' },
      sleep: SLEEP,
      tz: TZ,
      v: 1,
    });
  });
  it('the sleep snapshot is a copy, not the caller object', () => {
    const sleep = { ...SLEEP };
    const out = applyEntry({}, e(D1, 0, 1), { sleep, tz: TZ });
    expect(out[D1]!.sleep).not.toBe(sleep);
  });
  it('no note means no notes key', () => {
    expect(applyEntry({}, e(D1, 5, 2, 'r'), OPTS)[D1]!.notes).toEqual({});
  });
  it('splits across midnight and copies the note to each part', () => {
    const out = applyEntry({}, e(D1, 46, 4, 'b', 'late'), OPTS);
    expect(Object.keys(out).sort()).toEqual([D1, D2]);
    expect(out[D1]!.slots).toBe(slotsOf(run(46, 48, 'b')));
    expect(out[D2]!.slots).toBe(slotsOf(run(0, 2, 'b')));
    expect(out[D1]!.notes).toEqual({ '46': 'late' });
    expect(out[D2]!.notes).toEqual({ '0': 'late' });
  });
  it('a 24h entry starting at 12:00 spans two days', () => {
    const out = applyEntry({}, e(D1, 24, 48, 'g'), OPTS);
    expect(out[D1]!.slots).toBe(slotsOf(run(24, 48, 'g')));
    expect(out[D2]!.slots).toBe(slotsOf(run(0, 24, 'g')));
  });
  it('existing docs keep their sleep snapshot, tz and reflection; only new docs get opts', () => {
    const existing = { ...doc({ 0: 'g' }), reflection: 'hello' };
    const out = applyEntry({ [D1]: existing }, e(D1, 46, 4, 'b'), OPTS);
    expect(out[D1]!.sleep).toEqual({ start: '22:00', end: '06:00' });
    expect(out[D1]!.tz).toBe('UTC');
    expect(out[D1]!.reflection).toBe('hello');
    expect(out[D1]!.slots.charAt(0)).toBe('g');
    expect(out[D2]!.sleep).toEqual(SLEEP);
    expect(out[D2]!.tz).toBe(TZ);
  });
  it('truncates long notes to 200 chars', () => {
    const out = applyEntry({}, e(D1, 0, 1, 'g', 'x'.repeat(250)), OPTS);
    expect(out[D1]!.notes['0']).toHaveLength(200);
  });
  it('empty note is dropped', () => {
    expect(applyEntry({}, e(D1, 0, 1, 'g', ''), OPTS)[D1]!.notes).toEqual({});
  });
  it('throws on invalid entries', () => {
    expect(() => applyEntry({}, e(D1, 0, 0), OPTS)).toThrow();
    expect(() => applyEntry({}, e(D1, 48, 1), OPTS)).toThrow();
  });
});

describe('applyEntry (merging and notes)', () => {
  it('merges with a preceding same-category run, keeping the run start note', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'first' }) };
    const out = applyEntry(days, e(D1, 28, 2, 'g'), OPTS);
    expect(out[D1]!.slots).toBe(slotsOf(run(26, 30, 'g')));
    expect(out[D1]!.notes).toEqual({ '26': 'first' });
  });
  it('merges with a following run; the new entry start has no note so the merged-in note moves to run start', () => {
    const days = { [D1]: doc(run(28, 30, 'g'), { '28': 'later' }) };
    const out = applyEntry(days, e(D1, 26, 2, 'g'), OPTS);
    expect(out[D1]!.slots).toBe(slotsOf(run(26, 30, 'g')));
    expect(out[D1]!.notes).toEqual({ '26': 'later' });
  });
  it('moves the new entry note to the run start when the preceding run has none', () => {
    const days = { [D1]: doc(run(26, 28, 'g')) };
    const out = applyEntry(days, e(D1, 28, 2, 'g', 'new'), OPTS);
    expect(out[D1]!.notes).toEqual({ '26': 'new' });
  });
  it('joins both notes with " · "', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'A' }) };
    const out = applyEntry(days, e(D1, 28, 2, 'g', 'B'), OPTS);
    expect(out[D1]!.notes).toEqual({ '26': 'A · B' });
  });
  it('joins in slot order when merging on both sides', () => {
    const days = {
      [D1]: doc({ ...run(20, 22, 'g'), ...run(24, 26, 'g') }, { '20': 'A', '24': 'C' }),
    };
    const out = applyEntry(days, e(D1, 22, 2, 'g', 'B'), OPTS);
    expect(out[D1]!.slots).toBe(slotsOf(run(20, 26, 'g')));
    expect(out[D1]!.notes).toEqual({ '20': 'A · B · C' });
  });
  it('truncates joined notes to 200 chars', () => {
    const a = 'a'.repeat(150);
    const b = 'b'.repeat(150);
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': a }) };
    const out = applyEntry(days, e(D1, 28, 2, 'g', b), OPTS);
    const note = out[D1]!.notes['26']!;
    expect(note).toHaveLength(200);
    expect(note.startsWith(a + ' · ')).toBe(true);
  });
  it('does not merge different categories', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'A' }) };
    const out = applyEntry(days, e(D1, 28, 2, 'b', 'B'), OPTS);
    expect(out[D1]!.notes).toEqual({ '26': 'A', '28': 'B' });
  });
  it('does not merge across midnight', () => {
    const days = { [D1]: doc(run(46, 48, 'g'), { '46': 'A' }) };
    const out = applyEntry(days, e(D2, 0, 2, 'g', 'B'), OPTS);
    expect(out[D2]!.notes).toEqual({ '0': 'B' });
    expect(D1 in out).toBe(false);
  });
  it('drops stray notes (not at a run start / pointing at dots) in touched days', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'ok', '40': 'stray', x: 'junk' }) };
    const out = applyEntry(days, e(D1, 2, 1, 'b'), OPTS);
    expect(out[D1]!.notes).toEqual({ '26': 'ok' });
  });
  it('overwriting a different-category run drops its note', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'old' }) };
    const out = applyEntry(days, e(D1, 26, 2, 'b'), OPTS);
    expect(out[D1]!.slots).toBe(slotsOf(run(26, 28, 'b')));
    expect(out[D1]!.notes).toEqual({});
  });
});

describe('applyEntry (replace / edit)', () => {
  const orig = e(D1, 26, 3, 'g', 'orig');
  const base = { [D1]: doc(run(26, 29, 'g'), { '26': 'orig' }) };

  it('changes category in place and updates the note', () => {
    const out = applyEntry(base, e(D1, 26, 3, 'r', 'new'), { ...OPTS, replace: orig });
    expect(out[D1]!.slots).toBe(slotsOf(run(26, 29, 'r')));
    expect(out[D1]!.notes).toEqual({ '26': 'new' });
  });
  it('changing category without a note removes the old note', () => {
    const out = applyEntry(base, e(D1, 26, 3, 'b'), { ...OPTS, replace: orig });
    expect(out[D1]!.notes).toEqual({});
  });
  it('moves an entry later within the day', () => {
    const out = applyEntry(base, e(D1, 30, 3, 'g', 'orig'), { ...OPTS, replace: orig });
    expect(out[D1]!.slots).toBe(slotsOf(run(30, 33, 'g')));
    expect(out[D1]!.notes).toEqual({ '30': 'orig' });
  });
  it('shrinks an entry', () => {
    const out = applyEntry(base, e(D1, 26, 1, 'g', 'orig'), { ...OPTS, replace: orig });
    expect(out[D1]!.slots).toBe(slotsOf({ 26: 'g' }));
    expect(out[D1]!.notes).toEqual({ '26': 'orig' });
  });
  it('moves an entry across midnight, clearing the old day and creating the next', () => {
    const out = applyEntry(base, e(D1, 46, 4, 'g', 'orig'), { ...OPTS, replace: orig });
    expect(out[D1]!.slots).toBe(slotsOf(run(46, 48, 'g')));
    expect(out[D1]!.notes).toEqual({ '46': 'orig' });
    expect(out[D2]!.slots).toBe(slotsOf(run(0, 2, 'g')));
  });
  it('moves a midnight-crossing entry back into one day, clearing both days', () => {
    const crossing = applyEntry({}, e(D1, 46, 4, 'g', 'x'), OPTS);
    const days = { [D1]: crossing[D1], [D2]: crossing[D2] };
    const out = applyEntry(days, e(D1, 10, 4, 'g', 'x'), {
      ...OPTS,
      replace: e(D1, 46, 4, 'g', 'x'),
    });
    expect(out[D1]!.slots).toBe(slotsOf(run(10, 14, 'g')));
    expect(out[D1]!.notes).toEqual({ '10': 'x' });
    expect(out[D2]!.slots).toBe(emptySlots());
    expect(out[D2]!.notes).toEqual({});
  });
  it('replace on a day that has no doc is ignored', () => {
    const out = applyEntry({}, e(D1, 5, 1), { ...OPTS, replace: e(D2, 5, 1) });
    expect(Object.keys(out)).toEqual([D1]);
  });
  it('replacing with an identical entry changes nothing', () => {
    expect(applyEntry(base, { ...orig }, { ...OPTS, replace: orig })).toEqual({});
  });
  it('merging a moved entry with a neighbour keeps the neighbour start note', () => {
    const days = {
      [D1]: doc({ ...run(26, 29, 'g'), ...run(32, 34, 'g') }, { '26': 'orig', '32': 'nbr' }),
    };
    const out = applyEntry(days, e(D1, 30, 2, 'g', 'orig'), { ...OPTS, replace: orig });
    expect(out[D1]!.slots).toBe(slotsOf(run(30, 34, 'g')));
    expect(out[D1]!.notes).toEqual({ '30': 'orig · nbr' });
  });
  it('only returns changed days', () => {
    const days = { [D1]: base[D1], [D2]: doc({ 3: 'b' }, { '3': 'keep' }) };
    const out = applyEntry(days, e(D1, 30, 3, 'g'), { ...OPTS, replace: orig });
    expect(Object.keys(out)).toEqual([D1]);
  });
});

describe('deleteEntry', () => {
  it('clears slots and note but keeps the doc', () => {
    const days = {
      [D1]: doc({ ...run(26, 29, 'g'), ...run(30, 32, 'b') }, { '26': 'a', '30': 'b' }),
    };
    const out = deleteEntry(days, e(D1, 26, 3, 'g'));
    expect(out[D1]!.slots).toBe(slotsOf(run(30, 32, 'b')));
    expect(out[D1]!.notes).toEqual({ '30': 'b' });
    expect(out[D1]!.sleep).toEqual({ start: '22:00', end: '06:00' });
  });
  it('can leave an all-dots doc', () => {
    const days = { [D1]: doc({ 5: 'r' }, { '5': 'n' }) };
    const out = deleteEntry(days, e(D1, 5, 1, 'r'));
    expect(out[D1]).toMatchObject({ slots: emptySlots(), notes: {}, v: 1 });
  });
  it('handles midnight-crossing entries', () => {
    const created = applyEntry({}, e(D1, 46, 4, 'b', 'n'), OPTS);
    const out = deleteEntry(created, e(D1, 46, 4, 'b'));
    expect(out[D1]!.slots).toBe(emptySlots());
    expect(out[D2]!.slots).toBe(emptySlots());
    expect(out[D2]!.notes).toEqual({});
  });
  it('is a no-op for missing days and already-empty slots', () => {
    expect(deleteEntry({}, e(D1, 5, 2))).toEqual({});
    expect(deleteEntry({ [D1]: doc() }, e(D1, 5, 2))).toEqual({});
  });
  it('throws on invalid entry', () => {
    expect(() => deleteEntry({}, e(D1, 0, 49))).toThrow();
  });
});

describe('immutability', () => {
  it('applyEntry never mutates its input', () => {
    const days = {
      [D1]: doc(run(26, 28, 'g'), { '26': 'A' }),
      [D2]: doc({ 1: 'b' }, { '1': 'z' }),
    };
    const frozen = clone(days);
    Object.freeze(days);
    Object.freeze(days[D1]);
    Object.freeze(days[D1].notes);
    Object.freeze(days[D1].sleep);
    const input = e(D1, 28, 4, 'g', 'B');
    const inputCopy = clone(input);
    const replace = e(D1, 26, 2, 'g', 'A');
    const out = applyEntry(days, input, { ...OPTS, replace });
    expect(days).toEqual(frozen);
    expect(input).toEqual(inputCopy);
    expect(out[D1]).not.toBe(days[D1]);
    expect(out[D1]!.notes).not.toBe(days[D1].notes);
    expect(out[D1]!.sleep).not.toBe(days[D1].sleep);
  });
  it('deleteEntry never mutates its input', () => {
    const days = { [D1]: doc(run(26, 28, 'g'), { '26': 'A' }) };
    const frozen = clone(days);
    Object.freeze(days[D1].notes);
    const out = deleteEntry(days, e(D1, 26, 2, 'g'));
    expect(days).toEqual(frozen);
    expect(out[D1]).not.toBe(days[D1]);
  });
  it('round-trips: apply then entriesFromDay', () => {
    const out = applyEntry({}, e(D1, 46, 4, 'r', 'late'), OPTS);
    expect(entriesFromDay(D1, out[D1])).toEqual([e(D1, 46, 2, 'r', 'late')]);
    expect(entriesFromDay(D2, out[D2])).toEqual([e(D2, 0, 2, 'r', 'late')]);
  });
});

describe('validateEntry', () => {
  const now = new Date(2026, 5, 10, 14, 20);
  it('accepts a valid past entry', () => {
    expect(validateEntry(e(D1, 26, 2, 'g', 'ok'), now)).toBeNull();
  });
  it('accepts an entry that has begun but not finished its last slot', () => {
    expect(validateEntry(e(D1, 26, 3), now)).toBeNull();
  });
  it('accepts exactly 48 slots in the past', () => {
    expect(validateEntry(e('2026-06-08', 0, 48), now)).toBeNull();
  });
  it('rejects bad lengths', () => {
    expect(validateEntry(e(D1, 0, 0), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, 0, 49), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, 0, 1.5), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, 0, -1), now)).toEqual(expect.any(String));
  });
  it('rejects bad start slots', () => {
    expect(validateEntry(e(D1, -1, 1), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, 48, 1), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, 1.5, 1), now)).toEqual(expect.any(String));
    expect(validateEntry(e(D1, Number.NaN, 1), now)).toEqual(expect.any(String));
  });
  it('rejects invalid dates', () => {
    expect(validateEntry(e('2026-02-30', 0, 1), now)).toEqual(expect.any(String));
    expect(validateEntry(e('garbage', 0, 1), now)).toEqual(expect.any(String));
  });
  it('rejects invalid categories', () => {
    expect(validateEntry({ ...e(D1, 0, 1), category: 'x' as 'g' }, now)).toEqual(
      expect.any(String),
    );
  });
  it('notes: 200 ok, 201 rejected', () => {
    expect(validateEntry(e(D1, 0, 1, 'g', 'x'.repeat(200)), now)).toBeNull();
    expect(validateEntry(e(D1, 0, 1, 'g', 'x'.repeat(201)), now)).toEqual(expect.any(String));
  });
  it('rejects future entries, including across midnight', () => {
    expect(validateEntry(e(D1, 29, 1), now)).toMatch(/future/i);
    expect(validateEntry(e(D1, 26, 4), now)).toMatch(/future/i);
    expect(validateEntry(e(D2, 0, 1), now)).toMatch(/future/i);
    expect(validateEntry(e(D1, 46, 4), now)).toMatch(/future/i);
  });
});
