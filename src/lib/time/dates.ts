import type { DateKey } from '../../types';

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function toDateKey(d: Date): DateKey {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidDateKey(k: string): boolean {
  const m = DATE_KEY_RE.exec(k);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  dt.setFullYear(y);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Local midnight of the given date key. Throws on an invalid key. */
export function parseDateKey(k: DateKey): Date {
  if (!isValidDateKey(k)) throw new Error(`Invalid date key: ${k}`);
  const m = DATE_KEY_RE.exec(k)!;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setFullYear(Number(m[1]));
  return dt;
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = parseDateKey(k);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
