import { it } from 'vitest';
import {
  addDays,
  currentSlotInfo,
  defaultStart,
  formatSlotRange,
  hhmmToSlot,
  isEntryInFuture,
  isFutureSlot,
  isInSleepWindow,
  isSlotPast,
  lastHourWindow,
  monthRange,
  nonexistentSlots,
  slotStartDate,
  slotToHHmm,
  splitAcrossDays,
  toDateKey,
  weekRange,
} from '../../src/lib/time';
import { type GoldenCase, mk, nowInput, writeGolden } from './write';

const NOWS = [
  '2026-10-18T14:00:00', '2026-10-18T14:14:59', '2026-10-18T14:15:00', '2026-10-18T14:44:00',
  '2026-10-18T14:45:00', '2026-10-18T23:50:00', '2026-10-18T00:00:00', '2026-10-18T00:14:00',
  '2026-10-18T00:20:00', '2026-10-18T00:50:00', '2027-01-01T00:20:00', '2026-12-31T23:50:00',
  '2026-03-08T03:10:00', '2026-03-08T03:00:00', '2026-03-08T01:50:00', '2026-03-08T00:10:00',
  '2026-03-09T00:20:00', '2026-11-01T01:30:00', '2026-11-01T02:10:00', '2026-11-01T12:00:00',
  '2026-04-05T03:20:00', '2026-10-04T03:10:00', '2026-10-04T00:20:00', '2026-04-05T12:00:00',
  '2026-04-05T01:45:00', '2026-10-04T02:45:00', '2026-10-04T02:10:00', '2026-03-29T12:00:00',
];
const DATES = [
  '2026-03-08', '2026-03-09', '2026-11-01', '2026-10-04', '2026-04-05', '2026-03-29',
  '2026-10-25', '2026-10-18', '2026-12-31', '2027-01-01', '2028-02-28', '2028-02-29',
];

it('time golden', () => {
  const c: GoldenCase[] = [];
  for (const s of NOWS) {
    const now = mk(s);
    const i = nowInput(s);
    c.push({ fn: 'lastHourWindow', input: i, output: lastHourWindow(now) });
    c.push({ fn: 'defaultStart', input: i, output: defaultStart(now) });
    c.push({ fn: 'currentSlotInfo', input: i, output: currentSlotInfo(now) });
    c.push({ fn: 'toDateKey', input: i, output: toDateKey(now) });
  }
  for (let s = 0; s <= 48; s++) {
    c.push({ fn: 'slotToHHmm', input: { slot: s }, output: slotToHHmm(s) });
    const t = slotToHHmm(s);
    c.push({ fn: 'hhmmToSlot', input: { hhmm: t }, output: hhmmToSlot(t) });
  }
  for (const [a, l] of [[0, 1], [26, 4], [46, 2], [0, 48], [47, 1]]) {
    c.push({ fn: 'formatSlotRange', input: { start: a, length: l }, output: formatSlotRange(a, l) });
  }
  const splits: Array<[string, number, number]> = [
    ['2026-10-18', 10, 4], ['2026-10-18', 46, 2], ['2026-10-18', 47, 2], ['2026-10-18', 47, 4],
    ['2026-12-31', 46, 4], ['2026-12-31', 47, 2], ['2028-02-28', 40, 20], ['2028-02-28', 0, 48],
    ['2026-10-18', 20, 48], ['2026-03-07', 44, 8], ['2026-03-08', 44, 10], ['2026-10-31', 47, 3],
  ];
  for (const [date, startSlot, length] of splits) {
    const e = { date, startSlot, length };
    c.push({ fn: 'splitAcrossDays', input: e, output: splitAcrossDays(e) });
    for (const s of ['2026-10-18T12:00:00', '2026-12-31T23:59:00']) {
      c.push({ fn: 'isEntryInFuture', input: { ...e, ...nowInput(s) }, output: isEntryInFuture(e, mk(s)) });
    }
  }
  for (const d of DATES) {
    c.push({ fn: 'nonexistentSlots', input: { date: d }, output: [...nonexistentSlots(d)].sort((a, b) => a - b) });
    c.push({ fn: 'addDays', input: { date: d, n: 1 }, output: addDays(d, 1) });
    c.push({ fn: 'addDays', input: { date: d, n: -1 }, output: addDays(d, -1) });
    for (const slot of [0, 4, 5, 6, 7, 47]) {
      c.push({ fn: 'slotStartDate', input: { date: d, slot }, output: slotStartDate(d, slot).getTime() });
    }
    for (const s of ['2026-03-08T03:10:00', '2026-10-18T14:20:00', '2027-01-01T00:00:00']) {
      const i = nowInput(s);
      for (const slot of [0, 6, 28, 47]) {
        c.push({ fn: 'isFutureSlot', input: { date: d, slot, ...i }, output: isFutureSlot(d, slot, mk(s)) });
        c.push({ fn: 'isSlotPast', input: { date: d, slot, ...i }, output: isSlotPast(d, slot, mk(s)) });
      }
    }
    for (const ws of ['sun', 'mon'] as const) {
      c.push({ fn: 'weekRange', input: { date: d, weekStart: ws }, output: weekRange(d, ws) });
    }
  }
  for (const [y, m0] of [[2026, 1], [2028, 1], [2026, 11], [2026, 2]]) {
    c.push({ fn: 'monthRange', input: { year: y, month0: m0 }, output: monthRange(y, m0) });
  }
  const sleeps = [
    { start: '23:00', end: '07:00' }, { start: '22:30', end: '06:30' }, { start: '01:00', end: '09:00' },
    { start: '00:00', end: '00:00' }, { start: '08:00', end: '08:00' }, { start: '23:30', end: '00:00' },
  ];
  for (const sleep of sleeps) {
    for (let slot = 0; slot < 48; slot++) {
      c.push({ fn: 'isInSleepWindow', input: { slot, sleep }, output: isInSleepWindow(slot, sleep) });
    }
  }
  writeGolden('time', c);
});
