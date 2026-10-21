import type { Category, DateKey, DayDoc, Entry, SleepWindow, SlotChar, SlotRef } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import {
  addDays,
  compareDateKeys,
  isEntryInFuture,
  isFutureSlot,
  isValidDateKey,
  splitAcrossDays,
} from '../time';

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

/**
 * Sanitizes a boundary mask: a '|' survives only where the slot is logged and either
 * sits at slot 0 ("do not join yesterday") or follows a slot of the same category
 * (between different categories a break is redundant). Returns undefined when nothing
 * is left, so the field can be omitted.
 */
export function normalizeBreaks(slots: string, breaks?: string): string | undefined {
  if (!breaks) return undefined;
  let out = '';
  let any = false;
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const ch = slots.charAt(i);
    const keep =
      breaks.charAt(i) === '|' &&
      ch !== '' &&
      ch !== '.' &&
      (i === 0 || slots.charAt(i - 1) === ch);
    out += keep ? '|' : '.';
    if (keep) any = true;
  }
  return any ? out : undefined;
}

/** Runs of the same category, also split at each (sanitized) boundary mark. */
export function entriesOf(slots: string, breaks?: string): Run[] {
  const mask = normalizeBreaks(slots, breaks);
  const runs: Run[] = [];
  let i = 0;
  while (i < slots.length) {
    const ch = slots[i];
    if (ch === '.') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < slots.length && slots[j] === ch && mask?.charAt(j) !== '|') j++;
    runs.push({ start: i, length: j - i, category: ch as Category });
    i = j;
  }
  return runs;
}

const truncate = (s: string): string => s.slice(0, MAX_NOTE_LENGTH);

export function entriesFromDay(
  k: DateKey,
  doc: Pick<DayDoc, 'slots' | 'notes' | 'breaks'> | undefined,
): Entry[] {
  if (!doc) return [];
  return entriesOf(doc.slots, doc.breaks).map((r) => {
    const entry: Entry = { date: k, startSlot: r.start, length: r.length, category: r.category };
    const note = doc.notes[String(r.start)];
    if (note) entry.note = note;
    return entry;
  });
}

export function entryAt(
  k: DateKey,
  doc: Pick<DayDoc, 'slots' | 'notes' | 'breaks'> | undefined,
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
 * Keeps notes only at entry starts. A note found inside an entry (left over from a
 * run that was merged in) is folded into the entry start's note.
 */
function normalizeNotes(doc: DayDoc): void {
  const notes: Record<string, string> = {};
  const keys = Object.keys(doc.notes)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  for (const run of entriesOf(doc.slots, doc.breaks)) {
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

/** JSON with object keys sorted, so equal docs compare equal whatever order their fields were set in. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

function sameDoc(a: DayDoc | undefined, b: DayDoc): boolean {
  return a !== undefined && stable(a) === stable(b);
}

const NO_BREAKS = '.'.repeat(SLOTS_PER_DAY);

/** The doc's mask as 48 chars of [.|] (no sanitizing), for editing. */
function maskOf(doc: Pick<DayDoc, 'breaks'>): string[] {
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) =>
    doc.breaks?.charAt(i) === '|' ? '|' : '.',
  );
}

function setMask(doc: DayDoc, set: (mask: string[]) => void): void {
  const mask = maskOf(doc);
  set(mask);
  doc.breaks = mask.join('');
}

/** The sanitized mask as a full 48-char string. */
const fullMask = (doc: Pick<DayDoc, 'slots' | 'breaks'> | undefined): string =>
  (doc && normalizeBreaks(doc.slots, doc.breaks)) ?? NO_BREAKS;

function dropNotesInRange(doc: DayDoc, start: number, length: number): void {
  for (const key of Object.keys(doc.notes)) {
    const slot = Number(key);
    if (slot >= start && slot < start + length) delete doc.notes[key];
  }
}

function clearBreaksInRange(doc: DayDoc, start: number, length: number): void {
  if (!doc.breaks) return;
  setMask(doc, (m) => {
    for (let i = start; i < start + length; i++) m[i] = '.';
  });
}

function clearParts(work: Map<DateKey, DayDoc>, days: DayMap, parts: Part[]): void {
  for (const p of parts) {
    const base = work.get(p.date) ?? days[p.date];
    if (!base) continue;
    const doc = work.get(p.date) ?? cloneDoc(base);
    doc.slots = setSlots(doc.slots, p.startSlot, p.length, '.');
    dropNotesInRange(doc, p.startSlot, p.length);
    clearBreaksInRange(doc, p.startSlot, p.length);
    work.set(p.date, doc);
  }
}

function collectChanged(work: Map<DateKey, DayDoc>, days: DayMap): Record<DateKey, DayDoc> {
  const changed: Record<DateKey, DayDoc> = {};
  for (const [date, doc] of work) {
    const breaks = normalizeBreaks(doc.slots, doc.breaks);
    if (breaks) doc.breaks = breaks;
    else delete doc.breaks;
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
  for (const [index, p] of parts.entries()) {
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
    const isFirst = index === 0;
    const isLast = index === parts.length - 1;
    setMask(doc, (m) => {
      for (let i = p.startSlot; i < p.startSlot + p.length; i++) m[i] = '.';
      if (isFirst) m[p.startSlot] = '|';
      const after = p.startSlot + p.length;
      if (isLast && after < SLOTS_PER_DAY) m[after] = '|';
    });
  }

  // An entry ending at midnight must not join a logged head on the next day.
  const lastPart = parts[parts.length - 1];
  if (lastPart.startSlot + lastPart.length === SLOTS_PER_DAY) {
    const nextDate = addDays(lastPart.date, 1);
    const base = work.get(nextDate) ?? days[nextDate];
    if (base && base.slots.charAt(0) !== '.' && base.slots.charAt(0) !== '') {
      const nextDoc = work.get(nextDate) ?? cloneDoc(base);
      setMask(nextDoc, (m) => {
        m[0] = '|';
      });
      work.set(nextDate, nextDoc);
    }
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

const hasSegment = (note: string, part: string): boolean =>
  note === part || note.split(NOTE_SEPARATOR).includes(part);

/** Notes of a midnight-crossing entry in time order, without repeating one the other already holds. */
function joinNotes(first: string | undefined, second: string | undefined): string | undefined {
  if (!first) return second;
  if (!second) return first;
  if (hasSegment(second, first)) return second;
  if (hasSegment(first, second)) return first;
  return truncate(`${first}${NOTE_SEPARATOR}${second}`);
}

/**
 * `tail` is an entry on `date` that ends at midnight. Returns it merged with the
 * next day's head entry when they share a category, fit in one 24h entry, and the
 * next day has no break at slot 0.
 */
function joinWithNext(days: DayMap, date: DateKey, tail: Entry): Entry | null {
  const nextDoc = days[addDays(date, 1)];
  const head = entriesFromDay(addDays(date, 1), nextDoc)[0];
  if (!head || head.startSlot !== 0) return null;
  if (fullMask(nextDoc).charAt(0) === '|') return null;
  if (head.category !== tail.category || tail.length + head.length > SLOTS_PER_DAY) return null;
  const joined: Entry = { ...tail, length: tail.length + head.length };
  const note = joinNotes(tail.note, head.note);
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
 * the earlier day and has both days' notes combined in time order.
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

interface NoteRef {
  date: DateKey;
  key: string;
  text: string;
}

/** What a drop changed, enough for `undoDrop` to reverse it. */
export interface DropUndo {
  category: Category;
  /** Each written slot with the character it held before. */
  slots: Array<SlotRef & { prev: SlotChar }>;
  /** Notes the drop removed or rewrote, as they were before. */
  removedNotes: NoteRef[];
  /** Notes the drop wrote (e.g. a note folded into a merged run start). */
  addedNotes: NoteRef[];
  /** Every boundary-mask char the drop changed, with its value before and after. */
  breaks: Array<SlotRef & { prev: '.' | '|'; next: '.' | '|' }>;
}

export interface DropPlan {
  changed: Record<DateKey, DayDoc>;
  undo: DropUndo;
  /** True when every target already holds the category, so nothing is written. */
  noop: boolean;
}

const cmpSlotRef = (a: SlotRef, b: SlotRef): number =>
  compareDateKeys(a.date, b.date) || a.slot - b.slot;

const follows = (prev: SlotRef, next: SlotRef): boolean =>
  next.date === prev.date
    ? next.slot === prev.slot + 1
    : prev.slot === SLOTS_PER_DAY - 1 && next.slot === 0 && next.date === addDays(prev.date, 1);

/** Groups sorted slots into runs of consecutive slots (crossing midnight), at most one day long. */
function contiguousRuns(sorted: SlotRef[]): Part[] {
  const runs: Part[] = [];
  let prev: SlotRef | undefined;
  for (const ref of sorted) {
    const last = runs[runs.length - 1];
    if (prev && last && last.length < SLOTS_PER_DAY && follows(prev, ref)) last.length++;
    else runs.push({ date: ref.date, startSlot: ref.slot, length: 1 });
    prev = ref;
  }
  return runs;
}

function diffNotes(
  before: DayMap,
  changed: Record<DateKey, DayDoc>,
): Pick<DropUndo, 'removedNotes' | 'addedNotes'> {
  const removedNotes: NoteRef[] = [];
  const addedNotes: NoteRef[] = [];
  for (const [date, after] of Object.entries(changed)) {
    const old = before[date]?.notes ?? {};
    for (const [key, text] of Object.entries(old)) {
      if (after.notes[key] !== text) removedNotes.push({ date, key, text });
    }
    for (const [key, text] of Object.entries(after.notes)) {
      if (old[key] !== text) addedNotes.push({ date, key, text });
    }
  }
  return { removedNotes, addedNotes };
}

function diffBreaks(before: DayMap, changed: Record<DateKey, DayDoc>): DropUndo['breaks'] {
  const out: DropUndo['breaks'] = [];
  for (const [date, after] of Object.entries(changed)) {
    const old = fullMask(before[date]);
    const now = fullMask(after);
    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      if (old[slot] !== now[slot]) {
        out.push({ date, slot, prev: old[slot] as '.' | '|', next: now[slot] as '.' | '|' });
      }
    }
  }
  return out;
}

/**
 * Plans a drag-to-drop log: every target slot gets `category` (overwriting logged
 * slots and dropping their notes). Targets that are still in the future relative
 * to `now` are ignored. Missing day docs are created with the sleep snapshot.
 */
export function planDrop(args: {
  days: DayMap;
  targets: SlotRef[];
  category: Category;
  sleep: SleepWindow;
  tz: string;
  now: Date;
}): DropPlan {
  const { days, category, sleep, tz, now } = args;
  const seen = new Set<string>();
  const targets = args.targets
    .filter((t) => !isFutureSlot(t.date, t.slot, now))
    .filter((t) => !seen.has(slotId(t.date, t.slot)) && seen.add(slotId(t.date, t.slot)))
    .sort(cmpSlotRef);

  const undo: DropUndo = {
    category,
    slots: [],
    removedNotes: [],
    addedNotes: [],
    breaks: [],
  };
  if (targets.every((t) => days[t.date]?.slots.charAt(t.slot) === category)) {
    return { changed: {}, undo, noop: true };
  }

  undo.slots = targets.map((t) => ({
    ...t,
    prev: (days[t.date]?.slots.charAt(t.slot) || '.') as SlotChar,
  }));

  let current: DayMap = days;
  const changed: Record<DateKey, DayDoc> = {};
  for (const run of contiguousRuns(targets)) {
    const next = applyEntry(current, { ...run, category }, { sleep, tz });
    Object.assign(changed, next);
    current = { ...current, ...next };
  }
  Object.assign(undo, diffNotes(days, changed));
  undo.breaks = diffBreaks(days, changed);
  return { changed, undo, noop: false };
}

/**
 * Reverses a drop on the current `days`. Only slots that still hold the dropped
 * category are restored, so later edits survive. Removed notes come back unless
 * their key has been written since.
 */
export function undoDrop(days: DayMap, undo: DropUndo): Record<DateKey, DayDoc> {
  const work = new Map<DateKey, DayDoc>();
  const docFor = (date: DateKey): DayDoc | undefined => {
    const existing = work.get(date);
    if (existing) return existing;
    const base = days[date];
    if (!base) return undefined;
    const copy = cloneDoc(base);
    work.set(date, copy);
    return copy;
  };

  const edited = new Set<string>();
  for (const s of undo.slots) {
    const doc = docFor(s.date);
    if (doc && doc.slots.charAt(s.slot) === undo.category) {
      doc.slots = setSlots(doc.slots, s.slot, 1, s.prev);
    } else {
      edited.add(slotId(s.date, s.slot));
    }
  }
  // A mark is restored only if it still has the value the drop gave it and the
  // slots on both sides of it were not changed since the drop.
  for (const b of undo.breaks ?? []) {
    const doc = docFor(b.date);
    if (!doc || fullMask(doc).charAt(b.slot) !== b.next) continue;
    if (edited.has(slotId(b.date, b.slot)) || edited.has(slotId(b.date, b.slot - 1))) continue;
    setMask(doc, (m) => {
      m[b.slot] = b.prev;
    });
  }
  for (const n of undo.addedNotes) {
    const doc = docFor(n.date);
    if (doc && doc.notes[n.key] === n.text) delete doc.notes[n.key];
  }
  for (const n of undo.removedNotes) {
    const doc = docFor(n.date);
    if (doc && !(n.key in doc.notes)) doc.notes[n.key] = n.text;
  }
  return collectChanged(work, days);
}
