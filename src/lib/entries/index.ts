import type { Category, DateKey, DayDoc, Entry, SleepWindow } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { addDays, isEntryInFuture, isValidDateKey, splitAcrossDays } from '../time';

export const MAX_NOTE_LENGTH = 200;
const NOTE_SEPARATOR = ' · ';

type DayMap = Record<DateKey, DayDoc | undefined>;
type Part = { date: DateKey; startSlot: number; length: number };

export function emptySlots(): string {
  return '.'.repeat(SLOTS_PER_DAY);
}

interface Run {
  start: number;
  length: number;
  category: Category;
}

function runsOf(slots: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < slots.length) {
    const ch = slots[i];
    if (ch === '.') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < slots.length && slots[j] === ch) j++;
    runs.push({ start: i, length: j - i, category: ch as Category });
    i = j;
  }
  return runs;
}

const truncate = (s: string): string => s.slice(0, MAX_NOTE_LENGTH);

export function entriesFromDay(
  k: DateKey,
  doc: Pick<DayDoc, 'slots' | 'notes'> | undefined,
): Entry[] {
  if (!doc) return [];
  return runsOf(doc.slots).map((r) => {
    const entry: Entry = { date: k, startSlot: r.start, length: r.length, category: r.category };
    const note = doc.notes[String(r.start)];
    if (note) entry.note = note;
    return entry;
  });
}

export function entryAt(
  k: DateKey,
  doc: Pick<DayDoc, 'slots' | 'notes'> | undefined,
  slot: number,
): Entry | null {
  return (
    entriesFromDay(k, doc).find((e) => slot >= e.startSlot && slot < e.startSlot + e.length) ?? null
  );
}

const slotId = (date: DateKey, slot: number): string => `${date}#${slot}`;

function slotIds(e: Part): Set<string> {
  const ids = new Set<string>();
  for (const p of splitAcrossDays(e)) {
    for (let s = p.startSlot; s < p.startSlot + p.length; s++) ids.add(slotId(p.date, s));
  }
  return ids;
}

/** Logged slots inside e's range, ignoring slots that belong to `ignore` (the entry being edited). */
export function findConflicts(
  days: DayMap,
  e: Pick<Entry, 'date' | 'startSlot' | 'length'>,
  ignore?: Pick<Entry, 'date' | 'startSlot' | 'length'>,
): Array<{ date: DateKey; slot: number }> {
  const ignored = ignore ? slotIds(ignore) : new Set<string>();
  const conflicts: Array<{ date: DateKey; slot: number }> = [];
  for (const p of splitAcrossDays(e)) {
    const doc = days[p.date];
    if (!doc) continue;
    for (let s = p.startSlot; s < p.startSlot + p.length; s++) {
      if (
        doc.slots.charAt(s) !== '.' &&
        doc.slots.charAt(s) !== '' &&
        !ignored.has(slotId(p.date, s))
      ) {
        conflicts.push({ date: p.date, slot: s });
      }
    }
  }
  return conflicts;
}

function cloneDoc(doc: DayDoc): DayDoc {
  return { ...doc, sleep: { ...doc.sleep }, notes: { ...doc.notes } };
}

function setSlots(slots: string, start: number, length: number, ch: string): string {
  return slots.slice(0, start) + ch.repeat(length) + slots.slice(start + length);
}

/**
 * Keeps notes only at run starts. A note found inside a run (left over from a
 * run that was merged in) is folded into the run start's note.
 */
function normalizeNotes(doc: DayDoc): void {
  const notes: Record<string, string> = {};
  const keys = Object.keys(doc.notes)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  for (const run of runsOf(doc.slots)) {
    const parts: string[] = [];
    for (const key of keys) {
      const slot = Number(key);
      const note = doc.notes[key];
      if (slot >= run.start && slot < run.start + run.length && note) parts.push(note);
    }
    if (parts.length > 0) notes[String(run.start)] = truncate(parts.join(NOTE_SEPARATOR));
  }
  doc.notes = notes;
}

function sameDoc(a: DayDoc | undefined, b: DayDoc): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

function dropNotesInRange(doc: DayDoc, start: number, length: number): void {
  for (const key of Object.keys(doc.notes)) {
    const slot = Number(key);
    if (slot >= start && slot < start + length) delete doc.notes[key];
  }
}

function clearParts(work: Map<DateKey, DayDoc>, days: DayMap, parts: Part[]): void {
  for (const p of parts) {
    const base = work.get(p.date) ?? days[p.date];
    if (!base) continue;
    const doc = work.get(p.date) ?? cloneDoc(base);
    doc.slots = setSlots(doc.slots, p.startSlot, p.length, '.');
    dropNotesInRange(doc, p.startSlot, p.length);
    work.set(p.date, doc);
  }
}

function collectChanged(work: Map<DateKey, DayDoc>, days: DayMap): Record<DateKey, DayDoc> {
  const changed: Record<DateKey, DayDoc> = {};
  for (const [date, doc] of work) {
    normalizeNotes(doc);
    if (!sameDoc(days[date], doc)) changed[date] = doc;
  }
  return changed;
}

/**
 * Writes e (clearing `replace` first when editing). Returns only the changed day
 * docs as new objects; the input is never mutated.
 */
export function applyEntry(
  days: DayMap,
  e: Entry,
  opts: { sleep: SleepWindow; tz: string; replace?: Entry },
): Record<DateKey, DayDoc> {
  const parts = splitAcrossDays(e);
  const work = new Map<DateKey, DayDoc>();

  if (opts.replace) clearParts(work, days, splitAcrossDays(opts.replace));

  const note = e.note ? truncate(e.note) : undefined;
  for (const p of parts) {
    let doc = work.get(p.date);
    if (!doc) {
      const existing = days[p.date];
      doc = existing
        ? cloneDoc(existing)
        : { slots: emptySlots(), notes: {}, sleep: { ...opts.sleep }, tz: opts.tz, v: 1 };
      work.set(p.date, doc);
    }
    doc.slots = setSlots(doc.slots, p.startSlot, p.length, e.category);
    dropNotesInRange(doc, p.startSlot, p.length);
    if (note) doc.notes[String(p.startSlot)] = note;
  }
  return collectChanged(work, days);
}

export function deleteEntry(days: DayMap, e: Entry): Record<DateKey, DayDoc> {
  const work = new Map<DateKey, DayDoc>();
  clearParts(work, days, splitAcrossDays(e));
  return collectChanged(work, days);
}

/** Error message, or null when the entry can be saved. */
export function validateEntry(e: Entry, now: Date): string | null {
  if (!isValidDateKey(e.date)) return 'Invalid date.';
  if (!Number.isInteger(e.startSlot) || e.startSlot < 0 || e.startSlot >= SLOTS_PER_DAY) {
    return 'Invalid start time.';
  }
  if (!Number.isInteger(e.length) || e.length < 1 || e.length > SLOTS_PER_DAY) {
    return 'Duration must be between 30 minutes and 24 hours.';
  }
  if (e.category !== 'g' && e.category !== 'b' && e.category !== 'r') return 'Invalid category.';
  if (e.note !== undefined && e.note.length > MAX_NOTE_LENGTH) {
    return `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`;
  }
  if (isEntryInFuture(e, now)) return 'Entries cannot be in the future.';
  return null;
}

const lastDay = (e: Pick<Entry, 'startSlot' | 'length'>): boolean =>
  e.startSlot + e.length === SLOTS_PER_DAY;

/**
 * `tail` is an entry on `date` that ends at midnight. Returns it merged with the
 * next day's head run when they share a category and fit in one 24h entry.
 */
function joinWithNext(days: DayMap, date: DateKey, tail: Entry): Entry | null {
  const head = entriesFromDay(addDays(date, 1), days[addDays(date, 1)])[0];
  if (!head || head.startSlot !== 0) return null;
  if (head.category !== tail.category || tail.length + head.length > SLOTS_PER_DAY) return null;
  const joined: Entry = { ...tail, length: tail.length + head.length };
  const note = tail.note ?? head.note;
  if (note) joined.note = note;
  else delete joined.note;
  return joined;
}

/** The entry on the previous day that joins into the head run `head` of `date`, if any. */
function joinedFromPrevious(days: DayMap, date: DateKey, head: Entry): Entry | null {
  if (head.startSlot !== 0) return null;
  const prevDate = addDays(date, -1);
  const tail = entriesFromDay(prevDate, days[prevDate]).find(lastDay);
  if (!tail) return null;
  const joined = joinWithNext(days, prevDate, tail);
  return joined && joined.length === tail.length + head.length ? joined : null;
}

/**
 * The entry covering a slot, where a run ending at midnight joins the next day's
 * first run (same category, at most 48 slots together). A joined entry starts on
 * the earlier day and has the earlier day's note, falling back to the later one.
 */
export function logicalEntryAt(days: DayMap, date: DateKey, slot: number): Entry | null {
  const e = entryAt(date, days[date], slot);
  if (!e) return null;
  return (
    joinedFromPrevious(days, date, e) ?? (lastDay(e) ? joinWithNext(days, date, e) : null) ?? e
  );
}

/** Entries overlapping `date` in time order, including one that started the previous day. */
export function logicalEntriesForDay(days: DayMap, date: DateKey): Entry[] {
  const result: Entry[] = [];
  for (const e of entriesFromDay(date, days[date])) {
    const fromPrev = joinedFromPrevious(days, date, e);
    if (fromPrev) result.push(fromPrev);
    else result.push((lastDay(e) ? joinWithNext(days, date, e) : null) ?? e);
  }
  return result;
}

export const MAX_REFLECTION_LENGTH = 1000;

/**
 * Returns the day doc with its reflection set to `text` (trimmed, at most 1000 chars).
 * Empty text removes the field. A missing doc is created with a sleep snapshot.
 */
export function withReflection(
  doc: DayDoc | undefined,
  text: string,
  opts: { sleep: SleepWindow; tz: string },
): DayDoc {
  const next: DayDoc = doc
    ? cloneDoc(doc)
    : { slots: emptySlots(), notes: {}, sleep: { ...opts.sleep }, tz: opts.tz, v: 1 };
  const value = text.trim().slice(0, MAX_REFLECTION_LENGTH);
  if (value) next.reflection = value;
  else delete next.reflection;
  return next;
}
