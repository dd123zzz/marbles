import type { SleepWindow, SlotRef } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { toDateKey } from './dates';
import { lastHourWindow } from './lastHour';
import { hhmmToSlot, nonexistentSlots } from './slots';

const WINDOW_SLOTS = 2;
const NOON_SLOT = 24;

export interface DropWindow {
  targets: SlotRef[];
  kind: 'gap' | 'lastHour';
}

/**
 * True if the slot is morning sleep that has already started (`slot < E`) and so can
 * anchor a drop window. A wrapping window's morning part is `[0, end)`. A non-wrapping
 * window is morning sleep only if it ends by 12:00; daytime and evening sleep never anchor.
 */
function isMorningSleep(slot: number, sleep: SleepWindow, started: number): boolean {
  if (slot >= started) return false;
  const s = hhmmToSlot(sleep.start);
  const e = hhmmToSlot(sleep.end);
  if (s === e) return false;
  if (s < e) return e <= NOON_SLOT && slot >= s && slot < e;
  return slot < e;
}

/**
 * Where a drop starts. Walks forward from the slot after today's latest logged
 * (or morning-sleep) slot and returns up to two slots below the rounded end of
 * `now`, skipping spring-forward slots that do not exist. Evening sleep is not
 * covered, so it can be caught up. When nothing fits it falls back to
 * `lastHourWindow(now)`. Today-only lookback: `slots` is today's day doc.
 */
export function nextDropWindow(args: {
  slots: string | undefined;
  sleep: SleepWindow;
  now: Date;
}): DropWindow {
  const { slots, sleep, now } = args;
  const today = toDateKey(now);
  const end = Math.floor((now.getHours() * 60 + now.getMinutes() + 15) / 30);
  const missing = nonexistentSlots(today);

  let anchor = -1;
  for (let i = SLOTS_PER_DAY - 1; i >= 0; i--) {
    if (missing.has(i)) continue;
    const logged = slots !== undefined && slots[i] !== undefined && slots[i] !== '.';
    if (logged || isMorningSleep(i, sleep, end)) {
      anchor = i;
      break;
    }
  }

  const targets: SlotRef[] = [];
  for (let i = anchor + 1; i < end && targets.length < WINDOW_SLOTS; i++) {
    if (!missing.has(i)) targets.push({ date: today, slot: i });
  }

  if (targets.length > 0) return { targets, kind: 'gap' };
  return { targets: lastHourWindow(now), kind: 'lastHour' };
}
