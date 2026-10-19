import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import { MAX_LATE_MS, hourlyNotification, nextHourBoundary } from './notify';

const at = (h: number, m = 0, s = 0, day = 18) => new Date(2026, 9, day, h, m, s);
const empty = '.'.repeat(48);
const doc = (slots: string): DayDoc => ({
  slots,
  notes: {},
  sleep: { start: '23:00', end: '07:00' },
  tz: 'America/Los_Angeles',
  v: 1,
});
const run = (boundary: Date, now: Date, prevDoc?: DayDoc) =>
  hourlyNotification({ boundary, now, prevDoc, settings: DEFAULT_SETTINGS });

describe('nextHourBoundary', () => {
  it('rolls to the next top of the hour', () => {
    expect(nextHourBoundary(at(13, 20, 5))).toEqual(at(14));
    expect(nextHourBoundary(at(13, 0, 0))).toEqual(at(14));
    expect(nextHourBoundary(at(23, 59, 59))).toEqual(at(0, 0, 0, 19));
  });
});

describe('hourlyNotification', () => {
  it('notifies for an awake, unlogged previous hour', () => {
    expect(run(at(14), at(14, 0, 1))).toEqual({
      title: 'Log your last hour',
      body: '13:00–14:00 is still empty',
      tag: 'marbles-hourly',
    });
  });

  it('is quiet when the previous hour is fully logged', () => {
    expect(run(at(14), at(14, 0, 1), doc(empty.slice(0, 26) + 'gg' + empty.slice(28)))).toBeNull();
  });

  it('says partly logged when only one half is logged', () => {
    const n = run(at(14), at(14, 0, 1), doc(empty.slice(0, 26) + 'g' + empty.slice(27)));
    expect(n?.body).toBe('13:00–14:00 is only partly logged');
  });

  it('is quiet when the previous hour was asleep', () => {
    expect(run(at(7), at(7, 0, 1))).toBeNull();
    expect(run(at(3), at(3, 0, 1))).toBeNull();
  });

  it('notifies at 08:00 for 07:00–08:00 (first awake hour)', () => {
    expect(run(at(8), at(8, 0, 1))?.body).toBe('07:00–08:00 is still empty');
  });

  it('at midnight, evaluates 23:00–24:00 of the previous day', () => {
    // sleep starts at 23:00, so that hour is sleep
    expect(run(at(0, 0, 0, 19), at(0, 0, 1, 19))).toBeNull();
    const late = { ...DEFAULT_SETTINGS, sleepStart: '01:00', sleepEnd: '09:00' };
    const n = hourlyNotification({
      boundary: at(0, 0, 0, 19),
      now: at(0, 0, 1, 19),
      prevDoc: undefined,
      settings: late,
    });
    expect(n?.body).toBe('23:00–24:00 is still empty');
  });

  it('is quiet when the timer fires long after the boundary', () => {
    const boundary = at(14);
    expect(run(boundary, new Date(boundary.getTime() + MAX_LATE_MS + 1))).toBeNull();
    expect(run(boundary, new Date(boundary.getTime() + MAX_LATE_MS))).not.toBeNull();
  });
});
