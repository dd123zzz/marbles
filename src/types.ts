export type Category = 'g' | 'b' | 'r';
export type SlotChar = Category | '.';
/** Local calendar date, YYYY-MM-DD */
export type DateKey = string;
/** Local wall-clock time, HH:mm */
export type HHmm = string;

export interface SleepWindow {
  start: HHmm;
  end: HHmm;
}

export interface DayDoc {
  /** 48 chars of [gbr.], one per 30 minutes from 00:00 */
  slots: string;
  /** note for the entry starting at that slot index (key is the slot index as a string) */
  notes: Record<string, string>;
  /** sleep window snapshot taken when the day doc was first created */
  sleep: SleepWindow;
  tz: string;
  reflection?: string;
  v: 1;
}

export type WeekStart = 'mon' | 'sun';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  sleepStart: HHmm;
  sleepEnd: HHmm;
  weekStart: WeekStart;
  theme: ThemePref;
  v: 1;
}

export const DEFAULT_SETTINGS: Settings = {
  sleepStart: '23:00',
  sleepEnd: '07:00',
  weekStart: 'mon',
  theme: 'system',
  v: 1,
};

/** A logged block of time. length is in 30-minute slots and may run past midnight. */
export interface Entry {
  date: DateKey;
  startSlot: number;
  length: number;
  category: Category;
  note?: string;
}

export type MarbleColor = Category | 'sleep' | 'unlogged' | 'empty' | 'na';

export interface Marble {
  /** 0..23 */
  hour: number;
  left: MarbleColor;
  right: MarbleColor;
  /** true when left === right */
  full: boolean;
  /** accessible label, e.g. "13:00–14:00 Wanted" */
  label: string;
}

export const SLOTS_PER_DAY = 48;
