import type { DateKey } from '../types';
import { parseDateKey } from './time';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon" */
export function weekdayShort(k: DateKey): string {
  return WEEKDAYS[parseDateKey(k).getDay()];
}

/** "Oct 12" */
export function monthDay(k: DateKey): string {
  const d = parseDateKey(k);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Mon Oct 12" */
export function weekdayMonthDay(k: DateKey): string {
  return `${weekdayShort(k)} ${monthDay(k)}`;
}

/** "Mon Oct 12, 2026" */
export function fullDate(k: DateKey): string {
  return `${weekdayMonthDay(k)}, ${parseDateKey(k).getFullYear()}`;
}

/** "October 2026" */
export function monthTitle(year: number, month0: number): string {
  return `${MONTHS_LONG[month0]} ${year}`;
}

/** Parses "YYYY-MM"; null when malformed. */
export function parseYearMonth(ym: string): { year: number; month0: number } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  return m ? { year: Number(m[1]), month0: Number(m[2]) - 1 } : null;
}

/** "2026-10" for the month `offset` months from (year, month0). */
export function shiftMonth(year: number, month0: number, offset: number): string {
  const d = new Date(year, month0 + offset, 1);
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
