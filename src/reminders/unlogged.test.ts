import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import { formatUnlogged, sleepFor, unloggedHours } from './unlogged';

const DATE = '2026-10-18';
const at = (h: number, m = 0) => new Date(2026, 9, 18, h, m);
const doc = (slots: string, sleep = { start: '23:00', end: '07:00' }): DayDoc => ({
  slots,
  notes: {},
  sleep,
  tz: 'America/Los_Angeles',
  v: 1,
});
const empty = '.'.repeat(48);
const withSlots = (from: number, to: number, ch = 'g') =>
  empty.slice(0, from) + ch.repeat(to - from) + empty.slice(to);

describe('unloggedHours', () => {
  it('is 0 before waking up (all sleep)', () => {
    expect(unloggedHours(DATE, undefined, DEFAULT_SETTINGS, at(6, 45))).toBe(0);
  });

  it('counts awake hours that have started, half-hours as 0.5', () => {
    // 07:00 wake; at 09:10 slots 14..18 have started (07:00–09:30) = 2.5h
    expect(unloggedHours(DATE, undefined, DEFAULT_SETTINGS, at(9, 10))).toBe(2.5);
  });

  it('counts a partly started hour', () => {
    expect(unloggedHours(DATE, undefined, DEFAULT_SETTINGS, at(7, 5))).toBe(0.5);
  });

  it('subtracts logged slots', () => {
    expect(unloggedHours(DATE, doc(withSlots(14, 18)), DEFAULT_SETTINGS, at(9, 10))).toBe(0.5);
    expect(unloggedHours(DATE, doc(withSlots(14, 19)), DEFAULT_SETTINGS, at(9, 10))).toBe(0);
  });

  it('does not count Purposeful slots as unlogged', () => {
    expect(unloggedHours(DATE, doc(withSlots(14, 18, 'p')), DEFAULT_SETTINGS, at(9, 10))).toBe(0.5);
  });

  it("uses the day's sleep snapshot over current settings", () => {
    const d = doc(empty, { start: '01:00', end: '09:00' });
    // awake 00:00–01:00 (2 slots) before sleep; asleep till 09:00
    expect(unloggedHours(DATE, d, DEFAULT_SETTINGS, at(8, 0))).toBe(1);
    expect(sleepFor(d, DEFAULT_SETTINGS)).toEqual({ start: '01:00', end: '09:00' });
    expect(sleepFor(undefined, { ...DEFAULT_SETTINGS, sleepStart: '22:00' })).toEqual({
      start: '22:00',
      end: '07:00',
    });
  });

  it('does not count future slots', () => {
    expect(unloggedHours(DATE, undefined, DEFAULT_SETTINGS, at(23, 40))).toBe(16);
  });
});

describe('formatUnlogged', () => {
  it('pluralizes and shows halves', () => {
    expect(formatUnlogged(1)).toBe('1 unlogged hour');
    expect(formatUnlogged(2)).toBe('2 unlogged hours');
    expect(formatUnlogged(2.5)).toBe('2.5 unlogged hours');
    expect(formatUnlogged(0.5)).toBe('0.5 unlogged hours');
  });
});
