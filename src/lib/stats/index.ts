import type { DateKey, DayDoc, SleepWindow } from '../../types';
import { computeMarbles } from '../jar';

export interface StatsHours {
  g: number;
  b: number;
  r: number;
  sleep: number;
  unlogged: number;
  notYet: number;
  na: number;
}

export interface Stats {
  hours: StatsHours;
  /** Share of awake time (g + b + r + unlogged; sleep excluded), 0..100 */
  awakePct: { g: number; b: number; r: number; unlogged: number };
  /** Share of all 24-hour days in range minus DST-nonexistent hours, 0..100 */
  dayPct: { g: number; b: number; r: number; sleep: number; unlogged: number; notYet: number };
}

export interface ComputeStatsInput {
  dates: DateKey[];
  days: Record<DateKey, DayDoc | undefined>;
  settingsSleep: SleepWindow;
  now: Date;
}

const pct = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

/** Percentages are exact here; round with roundPct for display only. */
export function computeStats({ dates, days, settingsSleep, now }: ComputeStatsInput): Stats {
  const hours: StatsHours = { g: 0, b: 0, r: 0, sleep: 0, unlogged: 0, notYet: 0, na: 0 };
  for (const date of dates) {
    const doc = days[date];
    const marbles = computeMarbles({
      date,
      slots: doc?.slots,
      sleep: doc?.sleep ?? settingsSleep,
      now,
    });
    for (const m of marbles) {
      for (const c of [m.left, m.right]) {
        if (c === 'empty') hours.notYet += 0.5;
        else hours[c] += 0.5;
      }
    }
  }

  const awake = hours.g + hours.b + hours.r + hours.unlogged;
  const total = dates.length * 24 - hours.na;
  return {
    hours,
    awakePct: {
      g: pct(hours.g, awake),
      b: pct(hours.b, awake),
      r: pct(hours.r, awake),
      unlogged: pct(hours.unlogged, awake),
    },
    dayPct: {
      g: pct(hours.g, total),
      b: pct(hours.b, total),
      r: pct(hours.r, total),
      sleep: pct(hours.sleep, total),
      unlogged: pct(hours.unlogged, total),
      notYet: pct(hours.notYet, total),
    },
  };
}

/** Rounds to 1 decimal, for display. */
export function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}
