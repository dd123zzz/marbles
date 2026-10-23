import { describe, expect, it } from 'vitest';
import type { Entry } from '../../types';
import {
  addDays,
  compareDateKeys,
  currentSlotInfo,
  dayFraction,
  defaultStart,
  formatSlotRange,
  hhmmToSlot,
  isEntryInFuture,
  isFutureSlot,
  isInSleepWindow,
  isSlotPast,
  isValidDateKey,
  monthGrid,
  monthRange,
  nonexistentSlots,
  parseDateKey,
  slotStartDate,
  slotToHHmm,
  splitAcrossDays,
  toDateKey,
  weekRange,
} from './index';

const entry = (date: string, startSlot: number, length: number): Entry => ({
  date,
  startSlot,
  length,
  category: 'g',
});

describe('dayFraction', () => {
  it('is the wall-clock fraction for today', () => {
    expect(dayFraction('2026-06-10', new Date(2026, 5, 10, 0, 0))).toBe(0);
    expect(dayFraction('2026-06-10', new Date(2026, 5, 10, 15, 0))).toBe(0.625);
    expect(dayFraction('2026-06-10', new Date(2026, 5, 10, 23, 59))).toBeCloseTo(0.9993, 4);
  });
  it('is null for another day', () => {
    expect(dayFraction('2026-06-09', new Date(2026, 5, 10, 12, 0))).toBeNull();
    expect(dayFraction('2026-06-11', new Date(2026, 5, 10, 12, 0))).toBeNull();
  });
  it('uses the wall clock on a spring-forward day', () => {
    expect(dayFraction('2026-03-08', new Date(2026, 2, 8, 3, 30))).toBe(210 / 1440);
  });
});

describe('test environment', () => {
  it('runs in America/Los_Angeles', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles');
  });
});

describe('date keys', () => {
  it('formats local dates', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
  it('parses to local midnight', () => {
    const d = parseDateKey('2026-06-10');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 5, 10, 0, 0,
    ]);
  });
  it('parses midnight on a DST day', () => {
    const d = parseDateKey('2026-03-08');
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
  });
  it('throws on invalid keys', () => {
    expect(() => parseDateKey('2026-02-30')).toThrow();
    expect(() => parseDateKey('nope')).toThrow();
  });
  it('validates keys', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-00-10')).toBe(false);
    expect(isValidDateKey('2026-1-10')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey('2026-01-10T00:00')).toBe(false);
  });
  it('adds days across month, year, leap day and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
  it('compares keys', () => {
    expect(compareDateKeys('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDateKeys('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDateKeys('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('slot conversion', () => {
  it('slotToHHmm', () => {
    expect(slotToHHmm(0)).toBe('00:00');
    expect(slotToHHmm(1)).toBe('00:30');
    expect(slotToHHmm(26)).toBe('13:00');
    expect(slotToHHmm(47)).toBe('23:30');
    expect(slotToHHmm(48)).toBe('24:00');
  });
  it('slotToHHmm rejects out-of-range', () => {
    expect(() => slotToHHmm(-1)).toThrow();
    expect(() => slotToHHmm(49)).toThrow();
    expect(() => slotToHHmm(1.5)).toThrow();
  });
  it('hhmmToSlot on boundaries', () => {
    expect(hhmmToSlot('00:00')).toBe(0);
    expect(hhmmToSlot('00:30')).toBe(1);
    expect(hhmmToSlot('23:30')).toBe(47);
    expect(hhmmToSlot('24:00')).toBe(48);
    expect(hhmmToSlot('07:00')).toBe(14);
  });
  it('hhmmToSlot floors off-boundary times', () => {
    expect(hhmmToSlot('13:29')).toBe(26);
    expect(hhmmToSlot('13:31')).toBe(27);
    expect(hhmmToSlot('13:59')).toBe(27);
  });
  it('hhmmToSlot rejects garbage', () => {
    expect(() => hhmmToSlot('25:00')).toThrow();
    expect(() => hhmmToSlot('24:30')).toThrow();
    expect(() => hhmmToSlot('12:60')).toThrow();
    expect(() => hhmmToSlot('abc')).toThrow();
  });
  it('round-trips every slot', () => {
    for (let s = 0; s <= 48; s++) expect(hhmmToSlot(slotToHHmm(s))).toBe(s);
  });
  it('formatSlotRange', () => {
    expect(formatSlotRange(26, 3)).toBe('13:00–14:30');
    expect(formatSlotRange(46, 2)).toBe('23:00–24:00');
    expect(formatSlotRange(0, 48)).toBe('00:00–24:00');
  });
});

describe('slotStartDate / currentSlotInfo', () => {
  it('builds local wall-clock dates', () => {
    const d = slotStartDate('2026-06-10', 27);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([10, 13, 30]);
  });
  it('slot 48 is next midnight', () => {
    const d = slotStartDate('2026-12-31', 48);
    expect(toDateKey(d)).toBe('2027-01-01');
    expect(d.getHours()).toBe(0);
  });
  it('currentSlotInfo returns the containing slot', () => {
    expect(currentSlotInfo(new Date(2026, 5, 10, 14, 20))).toEqual({
      date: '2026-06-10',
      slot: 28,
    });
    expect(currentSlotInfo(new Date(2026, 5, 10, 14, 30))).toEqual({
      date: '2026-06-10',
      slot: 29,
    });
    expect(currentSlotInfo(new Date(2026, 5, 10, 14, 29, 59))).toEqual({
      date: '2026-06-10',
      slot: 28,
    });
    expect(currentSlotInfo(new Date(2026, 5, 10, 0, 0))).toEqual({ date: '2026-06-10', slot: 0 });
    expect(currentSlotInfo(new Date(2026, 5, 10, 23, 59))).toEqual({
      date: '2026-06-10',
      slot: 47,
    });
  });
});

describe('defaultStart', () => {
  it('is the previous full hour', () => {
    expect(defaultStart(new Date(2026, 5, 10, 14, 20))).toEqual({
      date: '2026-06-10',
      startSlot: 26,
    });
  });
  it('exactly on the hour still goes back one hour', () => {
    expect(defaultStart(new Date(2026, 5, 10, 14, 0))).toEqual({
      date: '2026-06-10',
      startSlot: 26,
    });
  });
  it('just before the next hour', () => {
    expect(defaultStart(new Date(2026, 5, 10, 14, 59, 59))).toEqual({
      date: '2026-06-10',
      startSlot: 26,
    });
  });
  it('just after midnight gives the previous day 23:00', () => {
    expect(defaultStart(new Date(2026, 5, 10, 0, 20))).toEqual({
      date: '2026-06-09',
      startSlot: 46,
    });
    expect(defaultStart(new Date(2026, 5, 10, 0, 0))).toEqual({
      date: '2026-06-09',
      startSlot: 46,
    });
  });
  it('at 01:00 gives 00:00 the same day', () => {
    expect(defaultStart(new Date(2026, 5, 10, 1, 0))).toEqual({ date: '2026-06-10', startSlot: 0 });
  });
  it('crosses month and year boundaries', () => {
    expect(defaultStart(new Date(2027, 0, 1, 0, 5))).toEqual({ date: '2026-12-31', startSlot: 46 });
  });
});

describe('splitAcrossDays', () => {
  it('keeps a same-day entry whole', () => {
    expect(splitAcrossDays(entry('2026-06-10', 26, 3))).toEqual([
      { date: '2026-06-10', startSlot: 26, length: 3 },
    ]);
  });
  it('ending exactly at midnight does not spill', () => {
    expect(splitAcrossDays(entry('2026-06-10', 46, 2))).toEqual([
      { date: '2026-06-10', startSlot: 46, length: 2 },
    ]);
  });
  it('splits 23:00 + 2h into two days', () => {
    expect(splitAcrossDays(entry('2026-06-10', 46, 4))).toEqual([
      { date: '2026-06-10', startSlot: 46, length: 2 },
      { date: '2026-06-11', startSlot: 0, length: 2 },
    ]);
  });
  it('splits a 24h entry starting at 12:00', () => {
    expect(splitAcrossDays(entry('2026-06-10', 24, 48))).toEqual([
      { date: '2026-06-10', startSlot: 24, length: 24 },
      { date: '2026-06-11', startSlot: 0, length: 24 },
    ]);
  });
  it('a full-day entry from 00:00 is one part', () => {
    expect(splitAcrossDays(entry('2026-06-10', 0, 48))).toEqual([
      { date: '2026-06-10', startSlot: 0, length: 48 },
    ]);
  });
  it('a 24h entry from 23:30 spans two days', () => {
    expect(splitAcrossDays(entry('2026-12-31', 47, 48))).toEqual([
      { date: '2026-12-31', startSlot: 47, length: 1 },
      { date: '2027-01-01', startSlot: 0, length: 47 },
    ]);
  });
  it('total length is preserved', () => {
    for (let start = 0; start < 48; start++) {
      for (const len of [1, 2, 17, 48]) {
        const total = splitAcrossDays(entry('2026-06-10', start, len)).reduce(
          (n, p) => n + p.length,
          0,
        );
        expect(total).toBe(len);
      }
    }
  });
  it('throws on invalid input', () => {
    expect(() => splitAcrossDays(entry('2026-06-10', 0, 0))).toThrow();
    expect(() => splitAcrossDays(entry('2026-06-10', 0, 49))).toThrow();
    expect(() => splitAcrossDays(entry('2026-06-10', -1, 2))).toThrow();
    expect(() => splitAcrossDays(entry('2026-06-10', 48, 1))).toThrow();
    expect(() => splitAcrossDays(entry('2026-06-10', 1.5, 1))).toThrow();
    expect(() => splitAcrossDays(entry('2026-06-10', 0, 1.5))).toThrow();
    expect(() => splitAcrossDays(entry('2026-02-30', 0, 1))).toThrow();
  });
});

describe('future / past slots', () => {
  const now = new Date(2026, 5, 10, 14, 20); // inside slot 28
  it('a slot that has begun is not future', () => {
    expect(isFutureSlot('2026-06-10', 28, now)).toBe(false);
    expect(isFutureSlot('2026-06-10', 27, now)).toBe(false);
  });
  it('the next slot is future', () => {
    expect(isFutureSlot('2026-06-10', 29, now)).toBe(true);
  });
  it('a slot starting exactly now is not future', () => {
    expect(isFutureSlot('2026-06-10', 28, new Date(2026, 5, 10, 14, 0))).toBe(false);
    expect(isFutureSlot('2026-06-10', 29, new Date(2026, 5, 10, 14, 29, 59, 999))).toBe(true);
    expect(isFutureSlot('2026-06-10', 29, new Date(2026, 5, 10, 14, 30))).toBe(false);
  });
  it('other days', () => {
    expect(isFutureSlot('2026-06-11', 0, now)).toBe(true);
    expect(isFutureSlot('2026-06-09', 47, now)).toBe(false);
  });
  it('isSlotPast needs the slot to be fully elapsed', () => {
    expect(isSlotPast('2026-06-10', 27, now)).toBe(true);
    expect(isSlotPast('2026-06-10', 28, now)).toBe(false);
    expect(isSlotPast('2026-06-10', 28, new Date(2026, 5, 10, 14, 30))).toBe(true);
    expect(isSlotPast('2026-06-09', 47, new Date(2026, 5, 10, 0, 0))).toBe(true);
    expect(isSlotPast('2026-06-09', 47, new Date(2026, 5, 9, 23, 59))).toBe(false);
  });
  it('isEntryInFuture', () => {
    expect(isEntryInFuture(entry('2026-06-10', 26, 2), now)).toBe(false); // 13:00-14:00
    expect(isEntryInFuture(entry('2026-06-10', 26, 3), now)).toBe(false); // ends 14:30, last slot began 14:00
    expect(isEntryInFuture(entry('2026-06-10', 26, 4), now)).toBe(true); // last slot 14:30 not begun
    expect(isEntryInFuture(entry('2026-06-10', 29, 1), now)).toBe(true);
    expect(isEntryInFuture(entry('2026-06-11', 0, 1), now)).toBe(true);
  });
  it('isEntryInFuture checks the portion after midnight', () => {
    const late = new Date(2026, 5, 11, 0, 20);
    expect(isEntryInFuture(entry('2026-06-10', 46, 4), late)).toBe(true); // slot 1 (00:30) not begun
    expect(isEntryInFuture(entry('2026-06-10', 46, 3), late)).toBe(false);
    expect(isEntryInFuture(entry('2026-06-10', 46, 4), new Date(2026, 5, 11, 0, 30))).toBe(false);
  });
});

describe('DST', () => {
  it('spring-forward day has slots 4 and 5 nonexistent', () => {
    expect([...nonexistentSlots('2026-03-08')]).toEqual([4, 5]);
  });
  it('fall-back day has no nonexistent slots (repeated hour ignored)', () => {
    expect(nonexistentSlots('2026-11-01').size).toBe(0);
  });
  it('ordinary days have none', () => {
    expect(nonexistentSlots('2026-06-10').size).toBe(0);
    expect(nonexistentSlots('2026-03-07').size).toBe(0);
    expect(nonexistentSlots('2026-03-09').size).toBe(0);
  });
  it('slot arithmetic stays wall-clock after spring-forward', () => {
    const d = slotStartDate('2026-03-08', 6);
    expect([d.getHours(), d.getMinutes()]).toEqual([3, 0]);
    const end = slotStartDate('2026-03-08', 48);
    expect(toDateKey(end)).toBe('2026-03-09');
    expect(end.getHours()).toBe(0);
  });
  it('slot arithmetic stays wall-clock on fall-back day', () => {
    const d = slotStartDate('2026-11-01', 6);
    expect([d.getHours(), d.getMinutes()]).toEqual([3, 0]);
    expect(toDateKey(slotStartDate('2026-11-01', 48))).toBe('2026-11-02');
  });
});

describe('sleep window', () => {
  const night = { start: '23:00', end: '07:00' };
  it('wraps past midnight', () => {
    for (let s = 0; s < 14; s++) expect(isInSleepWindow(s, night)).toBe(true);
    for (let s = 14; s < 46; s++) expect(isInSleepWindow(s, night)).toBe(false);
    for (let s = 46; s < 48; s++) expect(isInSleepWindow(s, night)).toBe(true);
  });
  it('handles a same-day window', () => {
    const nap = { start: '13:00', end: '14:30' };
    expect([25, 26, 27, 28, 29, 30].map((s) => isInSleepWindow(s, nap))).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
  it('start == end means no sleep', () => {
    for (let s = 0; s < 48; s++)
      expect(isInSleepWindow(s, { start: '00:00', end: '00:00' })).toBe(false);
    expect(isInSleepWindow(10, { start: '22:00', end: '22:00' })).toBe(false);
  });
  it('end of 24:00 / start at midnight', () => {
    expect(isInSleepWindow(47, { start: '22:00', end: '24:00' })).toBe(true);
    expect(isInSleepWindow(0, { start: '00:00', end: '06:00' })).toBe(true);
    expect(isInSleepWindow(12, { start: '00:00', end: '06:00' })).toBe(false);
  });
  it('off-boundary settings floor to slots', () => {
    expect(isInSleepWindow(46, { start: '23:15', end: '07:10' })).toBe(true);
    expect(isInSleepWindow(14, { start: '23:15', end: '07:10' })).toBe(false);
  });
});

describe('weekRange', () => {
  it('monday start', () => {
    expect(weekRange('2026-06-10', 'mon')).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
    ]);
  });
  it('sunday start', () => {
    expect(weekRange('2026-06-10', 'sun')[0]).toBe('2026-06-07');
    expect(weekRange('2026-06-10', 'sun')[6]).toBe('2026-06-13');
  });
  it('a Sunday belongs to the week ending on it (mon start) or starting on it (sun start)', () => {
    expect(weekRange('2026-06-14', 'mon')[0]).toBe('2026-06-08');
    expect(weekRange('2026-06-14', 'sun')[0]).toBe('2026-06-14');
  });
  it('a Monday', () => {
    expect(weekRange('2026-06-08', 'mon')[0]).toBe('2026-06-08');
    expect(weekRange('2026-06-08', 'sun')[0]).toBe('2026-06-07');
  });
  it('crosses a month boundary', () => {
    expect(weekRange('2026-03-01', 'mon')).toEqual([
      '2026-02-23',
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });
  it('crosses a year boundary', () => {
    expect(weekRange('2026-12-31', 'mon')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(weekRange('2027-01-01', 'sun')[0]).toBe('2026-12-27');
  });
  it('spans the spring-forward and fall-back days', () => {
    expect(weekRange('2026-03-08', 'sun')).toHaveLength(7);
    expect(weekRange('2026-03-08', 'sun')[0]).toBe('2026-03-08');
    expect(weekRange('2026-11-01', 'mon')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
});

describe('month helpers', () => {
  it('monthRange', () => {
    expect(monthRange(2026, 5)).toEqual({ start: '2026-06-01', end: '2026-06-30' });
    expect(monthRange(2028, 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange(2026, 11)).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
  it('monthGrid rows are 7 wide with null padding (June 2026 starts Monday)', () => {
    const g = monthGrid(2026, 5, 'mon');
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(g).toHaveLength(5);
    expect(g[0]![0]).toBe('2026-06-01');
    expect(g[4]).toEqual(['2026-06-29', '2026-06-30', null, null, null, null, null]);
  });
  it('monthGrid with sunday start pads the leading cells', () => {
    const g = monthGrid(2026, 5, 'sun');
    expect(g[0]).toEqual([
      null,
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
    ]);
    expect(g).toHaveLength(5);
  });
  it('contains every day exactly once, in order', () => {
    for (const ws of ['mon', 'sun'] as const) {
      for (let m = 0; m < 12; m++) {
        const flat = monthGrid(2026, m, ws)
          .flat()
          .filter((x): x is string => x !== null);
        const { start, end } = monthRange(2026, m);
        expect(flat[0]).toBe(start);
        expect(flat[flat.length - 1]).toBe(end);
        expect(new Set(flat).size).toBe(flat.length);
        for (let i = 1; i < flat.length; i++) expect(flat[i]).toBe(addDays(flat[i - 1]!, 1));
      }
    }
  });
  it('February 2026 starting Sunday fits 4 rows with sun start', () => {
    expect(monthGrid(2026, 1, 'sun')).toHaveLength(4);
    expect(monthGrid(2026, 1, 'mon')).toHaveLength(5);
  });
  it('six-row month', () => {
    // Aug 2026 starts on Saturday: 5 leading (mon) + 31 days = 36 -> 6 rows
    expect(monthGrid(2026, 7, 'mon')).toHaveLength(6);
    expect(monthGrid(2026, 7, 'mon')[0]!.filter((c) => c === null)).toHaveLength(5);
  });
});
