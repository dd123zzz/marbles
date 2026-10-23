import { describe, expect, it } from 'vitest';
import type { DayDoc, MarbleColor } from '../../types';
import { weekRange } from '../time';
import { slotColors } from './index';
import { colorRuns, weekTimeline } from './timeline';

const SLEEP = { start: '23:00', end: '07:00' };
const dots = (): string[] => Array<string>(48).fill('.');
const make = (set: Record<number, string>): string => {
  const a = dots();
  for (const [i, c] of Object.entries(set)) a[Number(i)] = c;
  return a.join('');
};
const fill = (from: number, to: number, c: string): Record<number, string> =>
  Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, c]));
const doc = (slots: string, extra: Partial<DayDoc> = {}): DayDoc => ({
  slots,
  notes: {},
  sleep: SLEEP,
  tz: 'America/Los_Angeles',
  v: 1,
  ...extra,
});
const total = (s: Record<string, number>): number => Object.values(s).reduce((a, b) => a + b, 0);

describe('colorRuns', () => {
  it('handles empty input', () => {
    expect(colorRuns([])).toEqual([]);
  });
  it('makes one run for 48 equal colors', () => {
    expect(colorRuns(Array<MarbleColor>(48).fill('sleep'))).toEqual([
      { start: 0, length: 48, color: 'sleep' },
    ]);
  });
  it('splits alternating colors', () => {
    expect(colorRuns(['p', 'g', 'p', 'p'])).toEqual([
      { start: 0, length: 1, color: 'p' },
      { start: 1, length: 1, color: 'g' },
      { start: 2, length: 2, color: 'p' },
    ]);
  });
  it('merges same-category entries separated by a breaks mark', () => {
    const d = doc(make(fill(18, 24, 'g')), { breaks: make({ 21: '|' }) });
    const colors = slotColors({
      date: '2026-06-09',
      slots: d.slots,
      sleep: SLEEP,
      now: new Date(2026, 5, 10, 12, 0),
    });
    expect(colorRuns(colors).find((r) => r.color === 'g')).toEqual({
      start: 18,
      length: 6,
      color: 'g',
    });
  });
});

describe('weekTimeline', () => {
  const build = (
    date: string,
    days: Record<string, DayDoc | undefined>,
    now: Date,
    weekStart: 'mon' | 'sun' = 'mon',
  ) => weekTimeline({ dates: weekRange(date, weekStart), days, settingsSleep: SLEEP, now });

  it('spring-forward week: n/a segment on Mar 8, 23h, excluded from total', () => {
    const now = new Date(2026, 2, 10, 12, 0);
    const days: Record<string, DayDoc | undefined> = {};
    for (const d of weekRange('2026-03-02', 'mon')) days[d] = doc(make(fill(18, 24, 'g')));
    const { days: tl, total: tot } = build('2026-03-02', days, now);
    expect(tl.map((d) => d.date)).toHaveLength(7);
    const mar8 = tl[6];
    expect(mar8.date).toBe('2026-03-08');
    const na = mar8.segments.find((s) => s.color === 'na');
    expect(na).toMatchObject({ start: 4, length: 2 });
    expect(na?.label).toBe('02:00–03:00 Not applicable (DST)');
    expect(total(mar8.summary)).toBe(23);
    expect(total(tl[0].summary)).toBe(24);
    expect(total(tot)).toBe(6 * 24 + 23);
  });

  it('fall-back week: Nov 1 has 48 rows, no n/a, 24h', () => {
    const now = new Date(2026, 10, 3, 12, 0);
    const days: Record<string, DayDoc | undefined> = {};
    for (const d of weekRange('2026-10-26', 'mon')) days[d] = doc(make(fill(18, 24, 'g')));
    const { days: tl } = build('2026-10-26', days, now);
    const nov1 = tl[6];
    expect(nov1.date).toBe('2026-11-01');
    expect(nov1.segments.reduce((n, s) => n + s.length, 0)).toBe(48);
    expect(nov1.segments.some((s) => s.color === 'na')).toBe(false);
    expect(total(nov1.summary)).toBe(24);
  });

  it('midnight crossing: Tue run with a dot, Wed continuation without, then sleep', () => {
    const now = new Date(2026, 5, 20, 12, 0);
    const days = {
      '2026-06-16': doc(make(fill(44, 48, 'g')), { notes: { '44': 'late work' } }),
      '2026-06-17': doc(make(fill(0, 2, 'g'))),
    };
    const { days: tl } = build('2026-06-15', days, now);
    const tue = tl[1];
    const wed = tl[2];
    expect(tue.date).toBe('2026-06-16');
    const tueG = tue.segments.find((s) => s.color === 'g');
    expect(tueG).toMatchObject({ start: 44, length: 4, hasNote: true });
    expect(tueG?.label).toBe('22:00–24:00 Productive');
    expect(wed.segments[0]).toMatchObject({ start: 0, length: 2, color: 'g', hasNote: false });
    expect(wed.segments[1]).toMatchObject({ start: 2, color: 'sleep', length: 12 });
    expect(wed.noteCount).toBe(0);
  });

  it('Wednesday 00:00 logged over sleep shows b, then sleep from slot 2 to 14', () => {
    const now = new Date(2026, 5, 20, 12, 0);
    const { days: tl } = build('2026-06-15', { '2026-06-17': doc(make(fill(0, 2, 'b'))) }, now);
    const wed = tl[2];
    expect(wed.segments[0]).toMatchObject({ start: 0, length: 2, color: 'b' });
    expect(wed.segments[1]).toMatchObject({ start: 2, length: 12, color: 'sleep' });
  });

  it('today partially future: empty from slot 31 at 15:00, nowFraction 0.625', () => {
    const now = new Date(2026, 5, 17, 15, 0);
    const days = { '2026-06-17': doc(make(fill(18, 22, 'g'))) };
    const wed = build('2026-06-15', days, now).days[2];
    expect(wed.isToday).toBe(true);
    expect(wed.nowFraction).toBe(0.625);
    const last = wed.segments[wed.segments.length - 1];
    expect(last).toMatchObject({ start: 31, length: 17, color: 'empty' });
    expect(wed.segments[wed.segments.length - 2].color).toBe('unlogged');
    expect(wed.summary.unlogged).toBe(6.5); // slots 14..17 and 22..30
  });

  it('a slot that has begun (14:45 → slot 29) is not future', () => {
    const now = new Date(2026, 5, 17, 14, 45);
    const wed = build('2026-06-15', {}, now).days[2];
    const last = wed.segments[wed.segments.length - 1];
    expect(last).toMatchObject({ start: 30, color: 'empty' });
    expect(
      wed.segments.some((s) => s.start <= 29 && s.start + s.length > 29 && s.color === 'unlogged'),
    ).toBe(true);
  });

  it('empty past day is nothing logged with no segments and zero total', () => {
    const now = new Date(2026, 5, 17, 12, 0);
    const days = { '2026-06-16': doc(dots().join('')) };
    const { days: tl, total: tot } = build('2026-06-15', days, now);
    for (const d of [tl[0], tl[1]]) {
      expect(d.nothingLogged).toBe(true);
      expect(d.segments).toEqual([]);
      expect(total(d.summary)).toBe(0);
    }
    expect(tl[0].ariaLabel).toBe('Mon Jun 15: nothing logged');
    expect(total(tot)).toBe(total(tl[2].summary));
  });

  it('today with nothing logged is not blank', () => {
    const now = new Date(2026, 5, 17, 12, 0);
    const wed = build('2026-06-15', {}, now).days[2];
    expect(wed.nothingLogged).toBe(false);
    expect(wed.segments.length).toBeGreaterThan(0);
    expect(wed.ariaLabel.startsWith('Wed Jun 17, today: ')).toBe(true);
  });

  it('future day: one empty segment 0-48, "not yet", nowFraction null', () => {
    const now = new Date(2026, 5, 17, 12, 0);
    const fri = build('2026-06-15', {}, now).days[4];
    expect(fri.segments).toEqual([
      { start: 0, length: 48, color: 'empty', label: '00:00–24:00 Not yet', hasNote: false },
    ]);
    expect(fri.ariaLabel).toBe('Fri Jun 19: not yet');
    expect(fri.nowFraction).toBeNull();
    expect(fri.nothingLogged).toBe(false);
    expect(total(fri.summary)).toBe(0);
  });

  it('week start keeps date order; Sat and Sun are weekend either way', () => {
    const now = new Date(2026, 5, 17, 12, 0);
    for (const ws of ['mon', 'sun'] as const) {
      const { days: tl } = build('2026-06-17', {}, now, ws);
      expect(tl.map((d) => d.date)).toEqual(weekRange('2026-06-17', ws));
      expect(tl.filter((d) => d.isWeekend).map((d) => d.date)).toEqual(
        ws === 'mon' ? ['2026-06-20', '2026-06-21'] : ['2026-06-14', '2026-06-20'],
      );
    }
    const mon = build('2026-06-17', {}, now, 'mon').days;
    expect(mon[5].isWeekend && mon[6].isWeekend).toBe(true);
    expect(mon[0].isWeekend).toBe(false);
    const sun = build('2026-06-17', {}, now, 'sun').days;
    expect(sun[0].isWeekend && sun[6].isWeekend).toBe(true);
  });

  it('notes: stale keys ignored, merged run gives one dot and noteCount 2, reflection in label', () => {
    const now = new Date(2026, 5, 20, 12, 0);
    const d = doc(make(fill(18, 24, 'g')), {
      notes: { '18': 'a', '21': 'b', '5': 'stale', '99': 'bad', x: 'bad' },
      breaks: make({ 21: '|' }),
      reflection: 'good day',
    });
    const mon = build('2026-06-15', { '2026-06-15': d }, now).days[0];
    expect(mon.noteCount).toBe(2);
    expect(mon.hasReflection).toBe(true);
    expect(mon.segments.filter((s) => s.hasNote)).toHaveLength(1);
    expect(mon.segments.find((s) => s.color === 'g')).toMatchObject({
      start: 18,
      length: 6,
      hasNote: true,
    });
    expect(mon.ariaLabel).toBe(
      'Mon Jun 15: Productive 3h, Sleep 8h, Unlogged 13h, 2 notes, reflection',
    );
    expect(mon.description).toBe('Productive 09:00–12:00');
  });

  it('aria label: today, 1 note, half hours, category order', () => {
    const now = new Date(2026, 9, 20, 23, 59);
    const d = doc(make({ ...fill(14, 18, 'p'), ...fill(18, 35, 'g') }), { notes: { '14': 'n' } });
    const tue = weekTimeline({
      dates: ['2026-10-20'],
      days: { '2026-10-20': d },
      settingsSleep: SLEEP,
      now,
    }).days[0];
    expect(tue.ariaLabel).toBe(
      'Tue Oct 20, today: Purposeful 2h, Productive 8.5h, Sleep 8h, Unlogged 5.5h, 1 note',
    );
    expect(tue.description).toBe('Purposeful 07:00–09:00, Productive 09:00–17:30');
  });

  it('uses the doc sleep snapshot over settings', () => {
    const now = new Date(2026, 5, 20, 12, 0);
    const d = doc(make({ 20: 'p' }), { sleep: { start: '00:00', end: '01:00' } });
    const mon = build('2026-06-15', { '2026-06-15': d }, now).days[0];
    expect(mon.summary.sleep).toBe(1);
  });

  it('total equals the sum of daily summaries; past days sum to 24', () => {
    const now = new Date(2026, 5, 20, 12, 0);
    const days: Record<string, DayDoc | undefined> = {};
    for (const d of weekRange('2026-06-15', 'mon')) days[d] = doc(make(fill(18, 26, 'g')));
    const { days: tl, total: tot } = build('2026-06-15', days, now);
    for (const d of tl.slice(0, 5)) expect(total(d.summary)).toBe(24);
    for (const key of Object.keys(tot) as Array<keyof typeof tot>) {
      expect(tot[key]).toBe(tl.reduce((n, d) => n + d.summary[key], 0));
    }
  });
});
