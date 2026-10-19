import { computeMarbles } from '../lib/jar';
import { defaultStart, slotToHHmm } from '../lib/time';
import type { DayDoc, Settings } from '../types';
import { sleepFor } from './unlogged';

export const NOTIFICATION_TAG = 'marbles-hourly';
/** A timer that fires much later than its boundary (device slept) is stale: the banner covers it. */
export const MAX_LATE_MS = 10 * 60_000;
/** setTimeout can fire a hair early; aim just past the boundary. */
export const BOUNDARY_SLACK_MS = 500;

export interface ReminderNotification {
  title: string;
  body: string;
  tag: string;
}

/** The next top-of-hour strictly after `now`, in local time (DST-safe). */
export function nextHourBoundary(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
}

/**
 * What to notify at an hour boundary, or null to stay quiet. Only an awake,
 * not fully logged previous hour qualifies; `prevDoc` is the doc of the day
 * containing that hour (yesterday at 00:00).
 */
export function hourlyNotification(input: {
  boundary: Date;
  now: Date;
  prevDoc: DayDoc | undefined;
  settings: Settings;
}): ReminderNotification | null {
  const { boundary, now, prevDoc, settings } = input;
  if (now.getTime() - boundary.getTime() > MAX_LATE_MS) return null;

  const { date, startSlot } = defaultStart(boundary);
  const marble = computeMarbles({
    date,
    slots: prevDoc?.slots,
    sleep: sleepFor(prevDoc, settings),
    now,
  })[startSlot / 2];
  if (!marble || (marble.left !== 'unlogged' && marble.right !== 'unlogged')) return null;

  const range = `${slotToHHmm(startSlot)}–${slotToHHmm(startSlot + 2)}`;
  return {
    title: 'Log your last hour',
    body: `${range} is ${marble.full ? 'still empty' : 'only partly logged'}`,
    tag: NOTIFICATION_TAG,
  };
}

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

/** Prefers the service worker (required on Android Chrome); falls back to the page constructor. */
export async function showReminder(n: ReminderNotification): Promise<void> {
  const options: NotificationOptions = { body: n.body, tag: n.tag };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) {
        await reg.showNotification(n.title, options);
        return;
      }
    }
  } catch {
    // fall through to the constructor
  }
  new Notification(n.title, options);
}
