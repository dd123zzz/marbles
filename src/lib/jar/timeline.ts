import type { DateKey, DayDoc, MarbleColor, SleepWindow } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { weekdayMonthDay } from '../dateLabels';
import { dayFraction, formatSlotRange, parseDateKey, toDateKey } from '../time';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  hours,
  isCategory,
  isEmptyPastDay,
  slotColors,
  summarizeColors,
  type Summary,
} from './index';

export interface TimelineSegment {
  /** slot 0..47 */
  start: number;
  /** slots */
  length: number;
  color: MarbleColor;
  /** "09:00–12:00 Productive" */
  label: string;
  /** a valid note key falls in [start, start+length) */
  hasNote: boolean;
}

export interface TimelineDay {
  date: DateKey;
  /** [] when nothingLogged */
  segments: TimelineSegment[];
  nothingLogged: boolean;
  isToday: boolean;
  /** getDay() is 0 or 6, independent of weekStart */
  isWeekend: boolean;
  summary: Summary;
  noteCount: number;
  hasReflection: boolean;
  nowFraction: number | null;
  ariaLabel: string;
  /** Logged runs only: "Productive 09:00–12:00, Wasted 20:00–22:30" */
  description: string;
}

export interface ColorRun {
  start: number;
  length: number;
  color: MarbleColor;
}

/** Merges adjacent equal colors into runs. Entry boundaries (`breaks`) are ignored. */
export function colorRuns(colors: readonly MarbleColor[]): ColorRun[] {
  const runs: ColorRun[] = [];
  for (let i = 0; i < colors.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.color === colors[i]) last.length += 1;
    else runs.push({ start: i, length: 1, color: colors[i] });
  }
  return runs;
}

const emptySummary = (): Summary => ({ p: 0, g: 0, b: 0, r: 0, sleep: 0, unlogged: 0 });

/** Slot indexes of notes whose key is a valid slot holding a logged category. */
function validNoteSlots(doc: DayDoc | undefined): number[] {
  if (!doc) return [];
  const out: number[] = [];
  for (const key of Object.keys(doc.notes ?? {})) {
    if (!/^\d+$/.test(key)) continue;
    const slot = Number(key);
    if (slot >= SLOTS_PER_DAY) continue;
    if (isCategory(doc.slots.charAt(slot))) out.push(slot);
  }
  return out;
}

function ariaLabelFor(
  date: DateKey,
  state: 'logged' | 'nothing' | 'future',
  isToday: boolean,
  summary: Summary,
  noteCount: number,
  hasReflection: boolean,
): string {
  const day = weekdayMonthDay(date);
  if (state === 'nothing') return `${day}: nothing logged`;
  if (state === 'future') return `${day}: not yet`;
  const parts: string[] = [
    ...CATEGORIES.map((c) => [CATEGORY_LABEL[c], summary[c]] as const),
    ['Sleep', summary.sleep] as const,
    ['Unlogged', summary.unlogged] as const,
  ]
    .filter(([, h]) => h > 0)
    .map(([label, h]) => `${label} ${hours(h)}`);
  if (noteCount > 0) parts.push(noteCount === 1 ? '1 note' : `${noteCount} notes`);
  if (hasReflection) parts.push('reflection');
  return `${day}${isToday ? ', today' : ''}: ${parts.join(', ')}`;
}

export function weekTimeline(input: {
  dates: DateKey[];
  days: Record<DateKey, DayDoc | undefined>;
  settingsSleep: SleepWindow;
  now: Date;
}): { days: TimelineDay[]; total: Summary } {
  const { dates, days, settingsSleep, now } = input;
  const today = toDateKey(now);
  const total = emptySummary();

  const out = dates.map((date): TimelineDay => {
    const doc = days[date];
    const isToday = date === today;
    const nothingLogged = isEmptyPastDay(date, today, doc?.slots);
    const weekday = parseDateKey(date).getDay();
    const noteSlots = validNoteSlots(doc);
    const hasReflection = Boolean(doc?.reflection);
    const nowFraction = dayFraction(date, now);

    const colors = slotColors({
      date,
      slots: doc?.slots,
      sleep: doc?.sleep ?? settingsSleep,
      now,
    });
    const summary = nothingLogged ? emptySummary() : summarizeColors(colors);
    for (const k of Object.keys(total) as Array<keyof Summary>) total[k] += summary[k];

    const runs = nothingLogged ? [] : colorRuns(colors);
    const segments: TimelineSegment[] = runs.map((r) => ({
      ...r,
      label: `${formatSlotRange(r.start, r.length)} ${CATEGORY_LABEL[r.color]}`,
      hasNote: noteSlots.some((s) => s >= r.start && s < r.start + r.length),
    }));

    const description = runs
      .filter((r) => isCategory(r.color))
      .map((r) => `${CATEGORY_LABEL[r.color]} ${formatSlotRange(r.start, r.length)}`)
      .join(', ');

    const state = nothingLogged ? 'nothing' : date > today ? 'future' : 'logged';

    return {
      date,
      segments,
      nothingLogged,
      isToday,
      isWeekend: weekday === 0 || weekday === 6,
      summary,
      noteCount: noteSlots.length,
      hasReflection,
      nowFraction,
      ariaLabel: ariaLabelFor(date, state, isToday, summary, noteSlots.length, hasReflection),
      description,
    };
  });

  return { days: out, total };
}
