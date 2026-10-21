import type { Category, DateKey, DayDoc, SleepWindow } from '../../types';
import { entriesFromDay, normalizeBreaks } from '../entries';
import { slotStartDate } from '../time';

export interface DateRange {
  start: DateKey;
  end: DateKey;
}

export interface ExportRow {
  date: DateKey;
  start: string;
  end: string;
  duration_minutes: number;
  category: 'wanted' | 'wasted' | 'unwanted';
  note: string;
}

export interface ExportMeta {
  exportedAt: string;
  timezone: string;
}

export interface ExportDay {
  date: DateKey;
  slots: string;
  notes: Record<string, string>;
  /** Entry boundary mask; present only when the day has one. */
  breaks?: string;
  sleep: SleepWindow;
  tz: string;
  reflection?: string;
}

export interface ExportJson extends ExportMeta {
  range: DateRange;
  days: ExportDay[];
  entries: ExportRow[];
}

const CATEGORY_NAME: Record<Category, ExportRow['category']> = {
  g: 'wanted',
  b: 'wasted',
  r: 'unwanted',
};

export const CSV_HEADER = 'date,start,end,duration_minutes,category,note';

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO 8601 with the local UTC offset in effect at that instant (DST-aware). */
export function isoWithOffset(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return (
    `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function datesIn(days: Record<DateKey, DayDoc | undefined>, range: DateRange): DateKey[] {
  return Object.keys(days)
    .filter((k) => k >= range.start && k <= range.end && days[k] !== undefined)
    .sort();
}

/**
 * One row per entry per day (a log next to a same-category log is its own row),
 * ordered by date then start. Entries are stored
 * per day, so a midnight-crossing entry appears as two rows: one ending at
 * 24:00 (next day 00:00) and one starting at 00:00.
 */
export function exportRows(
  days: Record<DateKey, DayDoc | undefined>,
  range: DateRange,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const date of datesIn(days, range)) {
    for (const e of entriesFromDay(date, days[date])) {
      rows.push({
        date,
        start: isoWithOffset(slotStartDate(date, e.startSlot)),
        end: isoWithOffset(slotStartDate(date, e.startSlot + e.length)),
        duration_minutes: e.length * 30,
        category: CATEGORY_NAME[e.category],
        note: e.note ?? '',
      });
    }
  }
  return rows;
}

/** RFC 4180 field quoting. */
export function csvField(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 text with a leading BOM so spreadsheets detect the encoding. */
export function toCsv(days: Record<DateKey, DayDoc | undefined>, range: DateRange): string {
  const lines = exportRows(days, range).map((r) =>
    [r.date, r.start, r.end, r.duration_minutes, r.category, r.note].map(csvField).join(','),
  );
  return '\uFEFF' + [CSV_HEADER, ...lines].join('\r\n') + '\r\n';
}

export function toJson(
  days: Record<DateKey, DayDoc | undefined>,
  range: DateRange,
  meta: ExportMeta,
): string {
  const out: ExportJson = {
    exportedAt: meta.exportedAt,
    timezone: meta.timezone,
    range,
    days: datesIn(days, range).map((date) => {
      const d = days[date]!;
      const day: ExportDay = {
        date,
        slots: d.slots,
        notes: d.notes,
        sleep: d.sleep,
        tz: d.tz,
      };
      const breaks = normalizeBreaks(d.slots, d.breaks);
      if (breaks) day.breaks = breaks;
      if (d.reflection !== undefined) day.reflection = d.reflection;
      return day;
    }),
    entries: exportRows(days, range),
  };
  return JSON.stringify(out, null, 2);
}

export function exportFilename(range: DateRange, format: 'csv' | 'json'): string {
  return `marbles-${range.start}_${range.end}.${format}`;
}

/** Number of days with data and entries that fall in range. */
export function exportCounts(
  days: Record<DateKey, DayDoc | undefined>,
  range: DateRange,
): { days: number; entries: number } {
  return { days: datesIn(days, range).length, entries: exportRows(days, range).length };
}
