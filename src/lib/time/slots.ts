import type { DateKey, Entry, HHmm, SleepWindow } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { addDays, isValidDateKey, parseDateKey, toDateKey } from './dates';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Slot 0..48 to "HH:mm"; 48 is "24:00". */
export function slotToHHmm(slot: number): HHmm {
  if (!Number.isInteger(slot) || slot < 0 || slot > SLOTS_PER_DAY) {
    throw new Error(`Invalid slot: ${slot}`);
  }
  const mins = slot * 30;
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** "HH:mm" to slot index, flooring to the 30-minute boundary. "24:00" is 48. */
export function hhmmToSlot(t: HHmm): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new Error(`Invalid time: ${t}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) throw new Error(`Invalid time: ${t}`);
  return h * 2 + Math.floor(min / 30);
}

/** e.g. "13:00–14:30" */
export function formatSlotRange(start: number, length: number): string {
  return `${slotToHHmm(start)}–${slotToHHmm(start + length)}`;
}

/** Local wall-clock start of a slot. Slot 48 is the next day's midnight. */
export function slotStartDate(k: DateKey, slot: number): Date {
  const d = parseDateKey(k);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, slot * 30);
}

export function currentSlotInfo(now: Date): { date: DateKey; slot: number } {
  return {
    date: toDateKey(now),
    slot: Math.floor((now.getHours() * 60 + now.getMinutes()) / 30),
  };
}

/** Wall-clock position of `now` within day k, in [0, 1); null unless k is now's local date. */
export function dayFraction(k: DateKey, now: Date): number | null {
  if (toDateKey(now) !== k) return null;
  return (now.getHours() * 60 + now.getMinutes()) / 1440;
}

/** The previous full hour: 14:20 and 14:00 both give 13:00; 00:20 gives 23:00 the day before. */
export function defaultStart(now: Date): { date: DateKey; startSlot: number } {
  const today = toDateKey(now);
  const h = now.getHours();
  if (h === 0) return { date: addDays(today, -1), startSlot: 46 };
  return { date: today, startSlot: (h - 1) * 2 };
}

function assertValidEntryShape(e: Pick<Entry, 'date' | 'startSlot' | 'length'>): void {
  if (!isValidDateKey(e.date)) throw new Error(`Invalid date: ${e.date}`);
  if (!Number.isInteger(e.startSlot) || e.startSlot < 0 || e.startSlot >= SLOTS_PER_DAY) {
    throw new Error(`Invalid start slot: ${e.startSlot}`);
  }
  if (!Number.isInteger(e.length) || e.length < 1 || e.length > SLOTS_PER_DAY) {
    throw new Error(`Invalid length: ${e.length}`);
  }
}

/** Splits an entry that runs past midnight into one part per calendar day. */
export function splitAcrossDays(
  e: Pick<Entry, 'date' | 'startSlot' | 'length'>,
): Array<{ date: DateKey; startSlot: number; length: number }> {
  assertValidEntryShape(e);
  const parts: Array<{ date: DateKey; startSlot: number; length: number }> = [];
  let date = e.date;
  let start = e.startSlot;
  let remaining = e.length;
  while (remaining > 0) {
    const len = Math.min(remaining, SLOTS_PER_DAY - start);
    parts.push({ date, startSlot: start, length: len });
    remaining -= len;
    date = addDays(date, 1);
    start = 0;
  }
  return parts;
}

/** True if the slot starts after now. A slot that has already begun is not future. */
export function isFutureSlot(k: DateKey, slot: number, now: Date): boolean {
  return slotStartDate(k, slot).getTime() > now.getTime();
}

/** True if the slot has fully elapsed (its end is at or before now). */
export function isSlotPast(k: DateKey, slot: number, now: Date): boolean {
  return slotStartDate(k, slot + 1).getTime() <= now.getTime();
}

/** True if any slot of the entry, including those after midnight, is in the future. */
export function isEntryInFuture(
  e: Pick<Entry, 'date' | 'startSlot' | 'length'>,
  now: Date,
): boolean {
  return splitAcrossDays(e).some((p) => isFutureSlot(p.date, p.startSlot + p.length - 1, now));
}

/**
 * Slots whose local wall-clock time does not exist on that day (spring-forward).
 * On fall-back days the repeated hour is ignored: the jar still shows 24 hours
 * and the second occurrence of the hour is not represented.
 */
export function nonexistentSlots(k: DateKey): Set<number> {
  const d = parseDateKey(k);
  const result = new Set<number>();
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const h = Math.floor(slot / 2);
    const min = (slot % 2) * 30;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min);
    if (t.getHours() !== h || t.getMinutes() !== min) result.add(slot);
  }
  return result;
}

/** The sleep window applies within each calendar day and wraps past midnight. */
export function isInSleepWindow(slot: number, sleep: SleepWindow): boolean {
  const s = hhmmToSlot(sleep.start);
  const e = hhmmToSlot(sleep.end);
  if (s === e) return false;
  return s < e ? slot >= s && slot < e : slot >= s || slot < e;
}
