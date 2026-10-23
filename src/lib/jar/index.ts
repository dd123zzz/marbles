import type { Category, DateKey, Marble, MarbleColor, SleepWindow } from '../../types';
import { SLOTS_PER_DAY } from '../../types';
import { isFutureSlot, isInSleepWindow, nonexistentSlots, slotToHHmm } from '../time';

/** User-loggable categories in display order. */
export const CATEGORIES: readonly Category[] = ['p', 'g', 'r', 'b'];

export function isCategory(ch: string): ch is Category {
  return ch === 'p' || ch === 'g' || ch === 'b' || ch === 'r';
}

export const CATEGORY_LABEL: Record<MarbleColor, string> = {
  p: 'Purposeful',
  g: 'Productive',
  b: 'Wasted',
  r: 'Unwanted',
  sleep: 'Sleep',
  unlogged: 'Unlogged',
  empty: 'Not yet',
  na: 'Not applicable (DST)',
};

export const MARBLE_COLORS: Record<MarbleColor, string> = {
  p: '#8fe6bb',
  g: '#7cc4ef',
  b: '#6e6a8e',
  r: '#f08070',
  sleep: '#9aa6f4',
  unlogged: '#ebe6e1',
  empty: 'transparent',
  na: '#e2dde6',
};

export interface ComputeMarblesInput {
  date: DateKey;
  slots: string | undefined;
  sleep: SleepWindow;
  now: Date;
}

/** 24 marbles, index = hour (hour 0 first). Each is split into two 30-minute halves. */
export function computeMarbles(input: ComputeMarblesInput): Marble[] {
  const { date, slots, sleep, now } = input;
  const missing = nonexistentSlots(date);

  const colorOf = (slot: number): MarbleColor => {
    if (missing.has(slot)) return 'na';
    const ch = slots?.charAt(slot);
    if (ch !== undefined && isCategory(ch)) return ch;
    if (isFutureSlot(date, slot, now)) return 'empty';
    if (isInSleepWindow(slot, sleep)) return 'sleep';
    return 'unlogged';
  };

  return Array.from({ length: SLOTS_PER_DAY / 2 }, (_, hour) => {
    const left = colorOf(hour * 2);
    const right = colorOf(hour * 2 + 1);
    const start = slotToHHmm(hour * 2);
    const mid = slotToHHmm(hour * 2 + 1);
    const end = slotToHHmm(hour * 2 + 2);
    const label =
      left === right
        ? `${start}–${end} ${CATEGORY_LABEL[left]}`
        : `${start}–${mid} ${CATEGORY_LABEL[left]}, ${mid}–${end} ${CATEGORY_LABEL[right]}`;
    return { hour, left, right, full: left === right, label };
  });
}

/** True when any slot is logged (p/g/b/r); a missing doc or all-'.' slots is not. */
export function hasLoggedSlots(slots?: string): boolean {
  return slots !== undefined && /[pgbr]/.test(slots);
}

/** A day before `today` (both YYYY-MM-DD) with nothing logged; shown as an empty jar. */
export function isEmptyPastDay(date: DateKey, today: DateKey, slots?: string): boolean {
  return date < today && !hasLoggedSlots(slots);
}

export type Summary = Record<Category | 'sleep' | 'unlogged', number>;

/** Hours per category; each half marble counts 0.5. Empty and n/a halves are not counted. */
export function summarize(marbles: Marble[]): Summary {
  const sum: Summary = { p: 0, g: 0, b: 0, r: 0, sleep: 0, unlogged: 0 };
  for (const m of marbles) {
    for (const c of [m.left, m.right]) {
      if (c in sum) sum[c as keyof Summary] += 0.5;
    }
  }
  return sum;
}

const hours = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}h`;

export function formatSummary(sum: Summary): string {
  return [
    `G ${hours(sum.g)}`,
    `B ${hours(sum.b)}`,
    `R ${hours(sum.r)}`,
    `Sleep ${hours(sum.sleep)}`,
    `Unlogged ${hours(sum.unlogged)}`,
  ].join(' · ');
}
