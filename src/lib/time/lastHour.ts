import type { SlotRef } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { addDays, toDateKey } from './dates';
import { nonexistentSlots } from './slots';

const WINDOW_SLOTS = 2;

/**
 * The two wall-clock slots ending at `now` rounded to the nearest :00/:30
 * (:15 and :45 round up; seconds are ignored), in chronological order. The
 * window may start yesterday. Spring-forward slots that do not exist are
 * skipped and the walk continues back until two real slots are found.
 */
export function lastHourWindow(now: Date): SlotRef[] {
  const endIndex = Math.floor((now.getHours() * 60 + now.getMinutes() + 15) / 30);
  let date = toDateKey(now);
  let slot = endIndex - 1;
  const missing = new Map<string, Set<number>>();
  const result: SlotRef[] = [];
  while (result.length < WINDOW_SLOTS) {
    if (slot < 0) {
      date = addDays(date, -1);
      slot = SLOTS_PER_DAY - 1;
    }
    let skip = missing.get(date);
    if (!skip) {
      skip = nonexistentSlots(date);
      missing.set(date, skip);
    }
    if (!skip.has(slot)) result.unshift({ date, slot });
    slot--;
  }
  return result;
}
