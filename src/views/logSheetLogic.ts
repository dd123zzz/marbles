import type { Category, DateKey, DayDoc, Entry, SleepWindow } from '../types';
import { SLOTS_PER_DAY } from '../types';
import { applyEntry, findConflicts, validateEntry } from '../lib/entries';
import { addDays, defaultStart, slotToHHmm, toDateKey } from '../lib/time';

export interface FormState {
  date: DateKey;
  startSlot: number;
  /** in 30-minute slots */
  length: number;
  note: string;
  category: Category | null;
}

/** Past days default to 09:00 (slot 18). Today defaults to the previous full hour. */
export function defaultStartFor(
  viewDate: DateKey,
  now: Date,
): { date: DateKey; startSlot: number } {
  return viewDate === toDateKey(now) ? defaultStart(now) : { date: viewDate, startSlot: 18 };
}

export function createForm(start: { date: DateKey; startSlot: number }): FormState {
  return { ...start, length: 2, note: '', category: null };
}

export function editForm(entry: Entry): FormState {
  return {
    date: entry.date,
    startSlot: entry.startSlot,
    length: entry.length,
    note: entry.note ?? '',
    category: entry.category,
  };
}

/** Length in slots as H:mm, e.g. 3 gives "1:30". */
export function formatDuration(length: number): string {
  const mins = length * 30;
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

export function durationOptions(): Array<{ value: number; label: string }> {
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => ({
    value: i + 1,
    label: formatDuration(i + 1),
  }));
}

export function startOptions(): Array<{ value: number; label: string }> {
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => ({ value: i, label: slotToHHmm(i) }));
}

/** e.g. { text: "23:00–01:00", crossesMidnight: true } */
export function describeRange(
  startSlot: number,
  length: number,
): { text: string; crossesMidnight: boolean } {
  const end = startSlot + length;
  const crossesMidnight = end > SLOTS_PER_DAY;
  return {
    text: `${slotToHHmm(startSlot)}–${slotToHHmm(crossesMidnight ? end - SLOTS_PER_DAY : end)}`,
    crossesMidnight,
  };
}

export function buildEntry(form: FormState, category: Category): Entry {
  const entry: Entry = {
    date: form.date,
    startSlot: form.startSlot,
    length: form.length,
    category,
  };
  const note = form.note.trim();
  if (note) entry.note = note;
  return entry;
}

export type SavePlan =
  { ok: false; error: string } | { ok: true; conflicts: number; changed: Record<DateKey, DayDoc> };

interface PlanInput {
  days: Record<DateKey, DayDoc | undefined>;
  entry: Entry;
  original?: Entry;
  now: Date;
  sleep: SleepWindow;
  tz: string;
}

/** Validates the entry and works out the day docs to write, plus how many logged slots it overwrites. */
export function planSave({ days, entry, original, now, sleep, tz }: PlanInput): SavePlan {
  const error = validateEntry(entry, now);
  if (error) return { ok: false, error };
  const conflicts = findConflicts(days, entry, original).length;
  const changed = applyEntry(days, entry, { sleep, tz, replace: original });
  return { ok: true, conflicts, changed };
}

/** Date keys whose docs an entry (and its original, when editing) can touch. */
export function touchedRange(date: DateKey): { start: DateKey; end: DateKey } {
  return { start: date, end: addDays(date, 1) };
}
