import { computeMarbles, summarize } from '../lib/jar';
import type { DateKey, DayDoc, Settings, SleepWindow } from '../types';

/** The day's sleep window: the snapshot on the doc, or the current settings if the day has no doc yet. */
export function sleepFor(doc: DayDoc | undefined, settings: Settings): SleepWindow {
  return doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
}

/** Awake, not-logged hours (0.5 per half hour) in slots that have started by `now`. */
export function unloggedHours(
  date: DateKey,
  doc: DayDoc | undefined,
  settings: Settings,
  now: Date,
): number {
  const marbles = computeMarbles({
    date,
    slots: doc?.slots,
    sleep: sleepFor(doc, settings),
    now,
  });
  return summarize(marbles).unlogged;
}

/** "1 unlogged hour", "2.5 unlogged hours" */
export function formatUnlogged(hours: number): string {
  const n = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${n} unlogged ${hours === 1 ? 'hour' : 'hours'}`;
}
