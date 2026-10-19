import { describe, expect, it } from 'vitest';
import { lastHourWindow } from './index';

const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0): Date =>
  new Date(y, mo - 1, d, h, mi, s);
const june = (h: number, mi: number, s = 0): Date => at(2026, 6, 10, h, mi, s);
const T = '2026-06-10';
const Y = '2026-06-09';

describe('lastHourWindow (TZ America/Los_Angeles)', () => {
  it('runs in the pinned timezone', () => {
    expect(new Date(2026, 2, 8, 3, 10).getTimezoneOffset()).toBe(420);
    expect(new Date(2026, 2, 8, 1, 10).getTimezoneOffset()).toBe(480);
  });

  it.each([
    [14, 0, 26, 27],
    [14, 14, 26, 27],
  ])('%i:%i rounds to 14:00 -> 13:00–14:00', (h, m, a, b) => {
    expect(lastHourWindow(june(h, m))).toEqual([
      { date: T, slot: a },
      { date: T, slot: b },
    ]);
  });

  it.each([
    [14, 15],
    [14, 29],
    [14, 44],
  ])('%i:%i rounds to 14:30 -> 13:30–14:30', (h, m) => {
    expect(lastHourWindow(june(h, m))).toEqual([
      { date: T, slot: 27 },
      { date: T, slot: 28 },
    ]);
  });

  it('14:45 rounds up to 15:00 -> 14:00–15:00', () => {
    expect(lastHourWindow(june(14, 45))).toEqual([
      { date: T, slot: 28 },
      { date: T, slot: 29 },
    ]);
  });

  it('ignores seconds', () => {
    expect(lastHourWindow(june(14, 14, 59))).toEqual(lastHourWindow(june(14, 0)));
    expect(lastHourWindow(june(14, 15, 0))).toEqual(lastHourWindow(june(14, 44, 59)));
  });

  it('23:50 -> 23:00–24:00 today', () => {
    expect(lastHourWindow(june(23, 50))).toEqual([
      { date: T, slot: 46 },
      { date: T, slot: 47 },
    ]);
  });

  it.each([
    [0, 0],
    [0, 14],
  ])('%i:%i -> yesterday 23:00–24:00 only', (h, m) => {
    expect(lastHourWindow(june(h, m))).toEqual([
      { date: Y, slot: 46 },
      { date: Y, slot: 47 },
    ]);
  });

  it('00:20 -> yesterday 23:30 to today 00:30 (two days)', () => {
    expect(lastHourWindow(june(0, 20))).toEqual([
      { date: Y, slot: 47 },
      { date: T, slot: 0 },
    ]);
  });

  it('00:50 -> today 00:00–01:00', () => {
    expect(lastHourWindow(june(0, 50))).toEqual([
      { date: T, slot: 0 },
      { date: T, slot: 1 },
    ]);
  });

  it('crosses the year boundary: 2027-01-01 00:20 -> 2026-12-31 23:30 to 00:30', () => {
    expect(lastHourWindow(at(2027, 1, 1, 0, 20))).toEqual([
      { date: '2026-12-31', slot: 47 },
      { date: '2027-01-01', slot: 0 },
    ]);
  });

  it('crosses the month boundary at 00:00', () => {
    expect(lastHourWindow(at(2026, 3, 1, 0, 0))).toEqual([
      { date: '2026-02-28', slot: 46 },
      { date: '2026-02-28', slot: 47 },
    ]);
  });

  it('spring forward 2026-03-08 03:10 -> 01:00–02:00 (02:00–03:00 does not exist)', () => {
    expect(lastHourWindow(at(2026, 3, 8, 3, 10))).toEqual([
      { date: '2026-03-08', slot: 2 },
      { date: '2026-03-08', slot: 3 },
    ]);
  });

  it('spring forward 03:35 -> end 03:30, slot 03:00 and 01:30 (skips nonexistent)', () => {
    expect(lastHourWindow(at(2026, 3, 8, 3, 35))).toEqual([
      { date: '2026-03-08', slot: 3 },
      { date: '2026-03-08', slot: 6 },
    ]);
  });

  it('the day after spring forward is a normal window', () => {
    expect(lastHourWindow(at(2026, 3, 9, 3, 10))).toEqual([
      { date: '2026-03-09', slot: 4 },
      { date: '2026-03-09', slot: 5 },
    ]);
  });

  it('fall back 2026-11-01 uses wall-clock slots', () => {
    expect(lastHourWindow(at(2026, 11, 1, 2, 10))).toEqual([
      { date: '2026-11-01', slot: 2 },
      { date: '2026-11-01', slot: 3 },
    ]);
    expect(lastHourWindow(at(2026, 11, 1, 1, 50))).toEqual([
      { date: '2026-11-01', slot: 2 },
      { date: '2026-11-01', slot: 3 },
    ]);
  });

  it('is chronological with two distinct slots for every half hour of a day', () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      const w = lastHourWindow(june(Math.floor(m / 60), m % 60));
      expect(w).toHaveLength(2);
      const key = (r: { date: string; slot: number }): string =>
        `${r.date}#${String(r.slot).padStart(2, '0')}`;
      expect(key(w[0])! < key(w[1])!).toBe(true);
    }
  });
});
