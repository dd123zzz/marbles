import { describe, expect, it } from 'vitest';
import type { DayDoc } from '../../types';
import { csvField, exportCounts, exportFilename, exportRows, toCsv, toJson } from './index';

const SLEEP = { start: '23:00', end: '07:00' };
const doc = (set: Record<number, string>, notes: Record<string, string> = {}): DayDoc => ({
  slots: Array.from({ length: 48 }, (_, i) => set[i] ?? '.').join(''),
  notes,
  sleep: SLEEP,
  tz: 'America/Los_Angeles',
  v: 1,
});
const R = { start: '2026-01-01', end: '2026-12-31' };

describe('toCsv', () => {
  it('starts with a BOM and the header', () => {
    const csv = toCsv({}, R);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('date,start,end,duration_minutes,category,note\r\n');
  });

  it('writes one row per run with ISO times and a local offset', () => {
    const d = doc({ 45: 'g', 46: 'g', 47: 'b' }, { '45': 'late work' });
    const lines = toCsv({ '2026-10-15': d }, R).slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'date,start,end,duration_minutes,category,note',
      '2026-10-15,2026-10-15T22:30:00-07:00,2026-10-15T23:30:00-07:00,60,productive,late work',
      '2026-10-15,2026-10-15T23:30:00-07:00,2026-10-16T00:00:00-07:00,30,wasted,',
    ]);
  });

  it('exports p as purposeful', () => {
    const d = doc({ 20: 'p', 21: 'p', 30: 'g' });
    const rows = exportRows({ '2026-06-01': d }, R);
    expect(rows.map((r) => [r.category, r.duration_minutes])).toEqual([
      ['purposeful', 60],
      ['productive', 30],
    ]);
    expect(toCsv({ '2026-06-01': d }, R)).toContain(',purposeful,');
  });

  it('writes a midnight-crossing entry as two rows', () => {
    const rows = exportRows(
      { '2026-10-15': doc({ 46: 'r', 47: 'r' }), '2026-10-16': doc({ 0: 'r', 1: 'r' }) },
      R,
    );
    expect(rows.map((r) => [r.date, r.start, r.end])).toEqual([
      ['2026-10-15', '2026-10-15T23:00:00-07:00', '2026-10-16T00:00:00-07:00'],
      ['2026-10-16', '2026-10-16T00:00:00-07:00', '2026-10-16T01:00:00-07:00'],
    ]);
  });

  it('uses the DST-correct offset on spring-forward (2026-03-08)', () => {
    // 01:00-01:30 is PST; 03:00-03:30 is PDT; the day ends at PDT midnight
    const d = doc({ 2: 'g', 6: 'b', 47: 'r' });
    const rows = exportRows({ '2026-03-08': d }, R);
    expect(rows[0].start).toBe('2026-03-08T01:00:00-08:00');
    expect(rows[0].end).toBe('2026-03-08T01:30:00-08:00');
    expect(rows[1].start).toBe('2026-03-08T03:00:00-07:00');
    expect(rows[2].end).toBe('2026-03-09T00:00:00-07:00');
  });

  it('uses the DST-correct offset on fall-back (2026-11-01)', () => {
    const d = doc({ 0: 'g', 1: 'g', 4: 'b', 47: 'r' });
    const rows = exportRows({ '2026-11-01': d }, R);
    expect(rows[0].start).toBe('2026-11-01T00:00:00-07:00');
    expect(rows[0].end).toBe('2026-11-01T01:00:00-07:00');
    expect(rows[1].start).toBe('2026-11-01T02:00:00-08:00');
    expect(rows[2].start).toBe('2026-11-01T23:30:00-08:00');
    expect(rows[2].end).toBe('2026-11-02T00:00:00-08:00');
  });

  it('quotes commas, quotes and newlines per RFC 4180', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    const csv = toCsv({ '2026-06-01': doc({ 20: 'g' }, { '20': 'a, "b"\nc' }) }, R);
    expect(csv).toContain(',productive,"a, ""b""\nc"\r\n');
  });

  it('orders by date and filters to the range', () => {
    const days = {
      '2026-06-03': doc({ 0: 'g' }),
      '2026-06-01': doc({ 10: 'b' }),
      '2026-06-02': doc({ 0: 'r' }),
      '2026-07-01': doc({ 0: 'g' }),
    };
    const rows = exportRows(days, { start: '2026-06-01', end: '2026-06-03' });
    expect(rows.map((r) => r.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('writes one row per entry when same-category entries are adjacent', () => {
    const d = {
      ...doc({ 20: 'g', 21: 'g', 22: 'g', 23: 'g' }, { '20': 'one', '22': 'two' }),
      breaks: '.'.repeat(22) + '|' + '.'.repeat(25),
    };
    const rows = exportRows({ '2026-06-01': d }, R);
    expect(rows.map((r) => [r.start, r.end, r.note])).toEqual([
      ['2026-06-01T10:00:00-07:00', '2026-06-01T11:00:00-07:00', 'one'],
      ['2026-06-01T11:00:00-07:00', '2026-06-01T12:00:00-07:00', 'two'],
    ]);
    expect(exportCounts({ '2026-06-01': d }, R).entries).toBe(2);
  });

  it('ignores a stale break between different categories or on a gap', () => {
    const d = { ...doc({ 20: 'g', 21: 'b' }), breaks: '.'.repeat(21) + '|' + '.'.repeat(26) };
    expect(exportRows({ '2026-06-01': d }, R)).toHaveLength(2);
    const gap = { ...doc({ 20: 'g', 22: 'g' }), breaks: '.'.repeat(22) + '|' + '.'.repeat(25) };
    expect(exportRows({ '2026-06-01': gap }, R)).toHaveLength(2);
  });

  it('orders rows within a day by start time', () => {
    const rows = exportRows({ '2026-06-01': doc({ 30: 'g', 2: 'b', 10: 'r' }) }, R);
    expect(rows.map((r) => r.category)).toEqual(['wasted', 'unwanted', 'productive']);
  });
});

describe('toJson', () => {
  it('has the documented shape and is pretty-printed', () => {
    const d = { ...doc({ 20: 'g' }, { '20': 'hi' }), reflection: 'good day' };
    const text = toJson({ '2026-06-01': d, '2026-06-02': doc({}) }, R, {
      exportedAt: '2026-10-18T20:00:00-07:00',
      timezone: 'America/Los_Angeles',
    });
    expect(text).toContain('\n  "exportedAt"');
    const parsed = JSON.parse(text);
    expect(parsed.range).toEqual(R);
    expect(parsed.timezone).toBe('America/Los_Angeles');
    expect(parsed.days).toHaveLength(2);
    expect(parsed.days[0]).toEqual({
      date: '2026-06-01',
      slots: d.slots,
      notes: { '20': 'hi' },
      sleep: SLEEP,
      tz: 'America/Los_Angeles',
      reflection: 'good day',
    });
    expect('reflection' in parsed.days[1]).toBe(false);
    expect('breaks' in parsed.days[0]).toBe(false);
    expect(parsed.entries).toEqual([
      {
        date: '2026-06-01',
        start: '2026-06-01T10:00:00-07:00',
        end: '2026-06-01T10:30:00-07:00',
        duration_minutes: 30,
        category: 'productive',
        note: 'hi',
      },
    ]);
  });
});

describe('toJson breaks', () => {
  it('includes the sanitized mask when present and still lists one entry per line', () => {
    const mask = '.'.repeat(21) + '|' + '.'.repeat(26);
    const d = { ...doc({ 20: 'g', 21: 'g', 22: 'b' }), breaks: mask + '' };
    const parsed = JSON.parse(
      toJson({ '2026-06-01': d }, R, { exportedAt: 'x', timezone: 'America/Los_Angeles' }),
    );
    expect(parsed.days[0].breaks).toBe(mask);
    expect(parsed.entries).toHaveLength(3);
  });

  it('omits a mask with no surviving breaks', () => {
    const d = { ...doc({ 20: 'g' }), breaks: '.'.repeat(5) + '|' + '.'.repeat(42) };
    const parsed = JSON.parse(
      toJson({ '2026-06-01': d }, R, { exportedAt: 'x', timezone: 'America/Los_Angeles' }),
    );
    expect('breaks' in parsed.days[0]).toBe(false);
  });
});

describe('helpers', () => {
  it('builds filenames and counts', () => {
    expect(exportFilename({ start: '2026-01-01', end: '2026-01-31' }, 'csv')).toBe(
      'marbles-2026-01-01_2026-01-31.csv',
    );
    expect(
      exportCounts({ '2026-06-01': doc({ 0: 'g', 5: 'b' }), '2026-06-02': doc({}) }, R),
    ).toEqual({ days: 2, entries: 2 });
  });
});
