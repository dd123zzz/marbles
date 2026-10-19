import { emptySlots } from '../lib/entries';
import { hhmmToSlot } from '../lib/time';
import type { DayDoc, SleepWindow } from '../types';
import { SLOTS_PER_DAY } from '../types';

/** Hours slept in the window (wraps past midnight); 0 when start equals end. */
export function sleepHours(w: SleepWindow): number {
  const s = hhmmToSlot(w.start);
  const e = hhmmToSlot(w.end);
  return ((e - s + SLOTS_PER_DAY) % SLOTS_PER_DAY) / 2;
}

/** The day doc with a new sleep window; a missing doc is created empty. */
export function withSleep(
  doc: DayDoc | undefined,
  sleep: SleepWindow,
  opts: { fallback: SleepWindow; tz: string },
): DayDoc {
  const base: DayDoc = doc ?? {
    slots: emptySlots(),
    notes: {},
    sleep: { ...opts.fallback },
    tz: opts.tz,
    v: 1,
  };
  return { ...base, notes: { ...base.notes }, sleep: { ...sleep } };
}
