import type { DateKey, WeekStart } from '../../types';
import { addDays, parseDateKey, toDateKey } from './dates';

/** The 7 date keys of the week containing k. */
export function weekRange(k: DateKey, weekStart: WeekStart): DateKey[] {
  const dow = parseDateKey(k).getDay();
  const offset = weekStart === 'mon' ? (dow + 6) % 7 : dow;
  const first = addDays(k, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function monthRange(year: number, month0: number): { start: DateKey; end: DateKey } {
  return {
    start: toDateKey(new Date(year, month0, 1)),
    end: toDateKey(new Date(year, month0 + 1, 0)),
  };
}

/** Rows of 7 cells; days outside the month are null. */
export function monthGrid(
  year: number,
  month0: number,
  weekStart: WeekStart,
): (DateKey | null)[][] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = weekStart === 'mon' ? (first.getDay() + 6) % 7 : first.getDay();
  const cells: (DateKey | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, month0, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
