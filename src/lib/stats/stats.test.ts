import { describe, expect, it } from 'vitest';
import type { DayDoc } from '../../types';
import { computeStats, roundPct } from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const doc = (slots: string, sleep = SLEEP): DayDoc => ({ slots, notes: {}, sleep, tz: 'x', v: 1 });
const slotsWith = (set: Record<number, string>): string =>
  Array.from({ length: 48 }, (_, i) => set[i] ?? '.').join('');
const range = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));

const later = new Date(2026, 5, 12, 12, 0);

describe('computeStats', () => {
  it('counts a single past day with sleep, logged and unlogged time', () => {
    const slots = slotsWith({
      ...range(16, 20, 'g'),
      ...range(20, 22, 'b'),
      ...range(22, 23, 'r'),
    });
    const s = computeStats({
      dates: ['2026-06-10'],
      days: { '2026-06-10': doc(slots) },
      settingsSleep: SLEEP,
      now: later,
    });
    // sleep: 23:00-07:00 = 8h; g 2h, b 1h, r 0.5h; unlogged 24-8-3.5 = 12.5h
    expect(s.hours).toEqual({
      p: 0,
      g: 2,
      b: 1,
      r: 0.5,
      sleep: 8,
      unlogged: 12.5,
      notYet: 0,
      na: 0,
    });
    expect(s.awakePct.g).toBeCloseTo((2 / 16) * 100);
    const awakeSum = Object.values(s.awakePct).reduce((a, b) => a + b, 0);
    expect(awakeSum).toBeCloseTo(100);
    const daySum = Object.values(s.dayPct).reduce((a, b) => a + b, 0);
    expect(daySum).toBeCloseTo(100);
    expect(s.dayPct.sleep).toBeCloseTo((8 / 24) * 100);
  });

  it('counts p as its own row and in the awake denominator', () => {
    const slots = slotsWith({ ...range(16, 20, 'p'), ...range(20, 22, 'g') });
    const s = computeStats({
      dates: ['2026-06-10'],
      days: { '2026-06-10': doc(slots) },
      settingsSleep: SLEEP,
      now: later,
    });
    // awake = 16h (sleep 8h): p 2h, g 1h, unlogged 13h
    expect(s.hours).toMatchObject({ p: 2, g: 1, unlogged: 13 });
    expect(s.awakePct.p).toBeCloseTo((2 / 16) * 100);
    expect(s.awakePct.g).toBeCloseTo((1 / 16) * 100);
    expect(s.dayPct.p).toBeCloseTo((2 / 24) * 100);
    const awakeSum = Object.values(s.awakePct).reduce((a, b) => a + b, 0);
    expect(awakeSum).toBeCloseTo(100);
    const daySum = Object.values(s.dayPct).reduce((a, b) => a + b, 0);
    expect(daySum).toBeCloseTo(100);
  });

  it('uses the doc sleep snapshot, falling back to settings', () => {
    const s = computeStats({
      dates: ['2026-06-10', '2026-06-11'],
      days: { '2026-06-10': doc(slotsWith({}), { start: '00:00', end: '00:00' }) },
      settingsSleep: SLEEP,
      now: later,
    });
    expect(s.hours.sleep).toBe(8); // only the day without a doc
    expect(s.hours.unlogged).toBe(24 + 16);
  });

  it('counts future time as notYet and excludes it from awake time', () => {
    const now = new Date(2026, 5, 10, 12, 0);
    const s = computeStats({
      dates: ['2026-06-10', '2026-06-11'],
      days: {},
      settingsSleep: SLEEP,
      now,
    });
    // day 1: sleep 0-7 (7h), unlogged 07-12:30 (5.5h: the slot in progress counts), notYet 12:30-24 (11.5h); day 2: all notYet
    expect(s.hours.sleep).toBe(7);
    expect(s.hours.unlogged).toBe(5.5);
    expect(s.hours.notYet).toBe(11.5 + 24);
    expect(s.awakePct.unlogged).toBe(100);
    expect(s.dayPct.notYet).toBeCloseTo((35.5 / 48) * 100);
  });

  it('guards divide-by-zero', () => {
    const s = computeStats({ dates: [], days: {}, settingsSleep: SLEEP, now: later });
    expect(s.awakePct).toEqual({ p: 0, g: 0, b: 0, r: 0, unlogged: 0 });
    expect(Object.values(s.dayPct).every((v) => v === 0)).toBe(true);

    const allSleep = computeStats({
      dates: ['2026-06-10'],
      days: {},
      settingsSleep: { start: '00:00', end: '24:00' },
      now: later,
    });
    expect(allSleep.hours.sleep).toBe(24);
    expect(allSleep.awakePct.g).toBe(0);
    expect(allSleep.awakePct.p).toBe(0);
  });

  it('excludes nonexistent DST hours from the 24-hour denominator', () => {
    const now = new Date(2026, 2, 10, 12, 0);
    const s = computeStats({
      dates: ['2026-03-08'],
      days: {},
      settingsSleep: { start: '00:00', end: '00:00' },
      now,
    });
    expect(s.hours.na).toBe(1);
    expect(s.hours.unlogged).toBe(23);
    expect(s.dayPct.unlogged).toBeCloseTo(100);
  });

  it('matches jar totals across a week', () => {
    const slots = slotsWith(range(0, 48, 'g'));
    const s = computeStats({
      dates: ['2026-06-08', '2026-06-09'],
      days: { '2026-06-08': doc(slots), '2026-06-09': undefined },
      settingsSleep: SLEEP,
      now: later,
    });
    expect(s.hours.g).toBe(24);
    expect(s.hours.sleep).toBe(8);
    expect(s.hours.unlogged).toBe(16);
  });

  it('roundPct rounds to one decimal', () => {
    expect(roundPct(33.3333)).toBe(33.3);
    expect(roundPct(66.66667)).toBe(66.7);
    expect(roundPct(0)).toBe(0);
  });
});
