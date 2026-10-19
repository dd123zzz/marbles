import { it } from 'vitest';
import {
  CATEGORY_LABEL,
  MARBLE_COLORS,
  computeMarbles,
  formatSummary,
  hasLoggedSlots,
  isEmptyPastDay,
  summarize,
} from '../../src/lib/jar';
import { type GoldenCase, mk, nowInput, writeGolden } from './write';

const SLEEP = { start: '23:00', end: '07:00' };

function slotsStr(fill: (i: number) => string): string {
  return Array.from({ length: 48 }, (_, i) => fill(i)).join('');
}

it('jar golden', () => {
  const c: GoldenCase[] = [];
  const slotSets: Array<string | undefined> = [
    undefined,
    '.'.repeat(48),
    slotsStr((i) => 'gbr'[i % 3]),
    slotsStr((i) => (i % 5 === 0 ? 'g' : '.')),
    slotsStr((i) => (i >= 20 && i < 24 ? 'r' : '.')),
    slotsStr((i) => (i === 3 ? 'b' : '.')),
  ];
  const cases: Array<[string, string]> = [
    ['2026-10-18', '2026-10-18T14:20:00'],
    ['2026-10-18', '2026-10-19T09:00:00'],
    ['2026-10-18', '2026-10-17T09:00:00'],
    ['2026-03-08', '2026-03-08T12:00:00'],
    ['2026-03-08', '2026-03-09T12:00:00'],
    ['2026-11-01', '2026-11-01T12:00:00'],
    ['2026-04-05', '2026-04-06T12:00:00'],
    ['2026-10-04', '2026-10-05T12:00:00'],
  ];
  for (const [date, n] of cases) {
    for (const slots of slotSets) {
      for (const sleep of [SLEEP, { start: '00:00', end: '00:00' }]) {
        const input = { date, slots: slots ?? null, sleep, ...nowInput(n) };
        const marbles = computeMarbles({ date, slots, sleep, now: mk(n) });
        c.push({ fn: 'computeMarbles', input, output: marbles });
        const sum = summarize(marbles);
        c.push({ fn: 'summarize', input, output: sum });
        c.push({ fn: 'formatSummary', input, output: formatSummary(sum) });
      }
    }
  }
  for (const s of slotSets) {
    c.push({ fn: 'hasLoggedSlots', input: { slots: s ?? null }, output: hasLoggedSlots(s) });
    for (const [date, today] of [['2026-10-17', '2026-10-18'], ['2026-10-18', '2026-10-18'], ['2026-10-19', '2026-10-18']]) {
      c.push({ fn: 'isEmptyPastDay', input: { date, today, slots: s ?? null }, output: isEmptyPastDay(date, today, s) });
    }
  }
  c.push({ fn: 'CATEGORY_LABEL', input: {}, output: CATEGORY_LABEL });
  c.push({ fn: 'MARBLE_COLORS', input: {}, output: MARBLE_COLORS });
  writeGolden('jar', c);
});
