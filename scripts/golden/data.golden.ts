import { it } from 'vitest';
import {
  applyEntry,
  deleteEntry,
  entriesFromDay,
  logicalEntriesForDay,
  planDrop,
  undoDrop,
  validateEntry,
  withReflection,
} from '../../src/lib/entries';
import {
  CSV_HEADER,
  csvField,
  exportCounts,
  exportFilename,
  exportRows,
  isoWithOffset,
  toCsv,
  toJson,
} from '../../src/lib/export';
import { computeStats, roundPct } from '../../src/lib/stats';
import { lastHourWindow } from '../../src/lib/time';
import type { DayDoc, Entry } from '../../src/types';
import { type GoldenCase, ZONE, mk, nowInput, writeGolden } from './write';

const SLEEP = { start: '23:00', end: '07:00' };
const slots = (fill: (i: number) => string): string =>
  Array.from({ length: 48 }, (_, i) => fill(i)).join('');
const doc = (
  s: string,
  notes: Record<string, string> = {},
  extra: Partial<DayDoc> = {},
): DayDoc => ({
  slots: s,
  notes,
  sleep: SLEEP,
  tz: ZONE,
  v: 1,
  ...extra,
});

const DAYS: Record<string, DayDoc> = {
  '2026-10-17': doc(
    slots((i) => (i >= 18 && i < 22 ? 'g' : i === 30 ? 'b' : '.')),
    { '18': 'deep work, "quoted"', '30': 'a,b' },
  ),
  '2026-10-18': doc(
    slots((i) => (i < 4 ? 'r' : i >= 26 && i < 30 ? 'b' : i === 40 ? 'g' : '.')),
    { '26': 'line\nbreak' },
    { reflection: 'good day' },
  ),
  '2026-03-08': doc(slots((i) => (i === 0 ? 'g' : '.'))),
  '2026-12-31': doc(slots((i) => (i >= 44 ? 'g' : '.'))),
  '2027-01-01': doc(slots((i) => (i < 2 ? 'g' : '.'))),
};

it('data golden', () => {
  const entries: GoldenCase[] = [];
  const stats: GoldenCase[] = [];
  const exp: GoldenCase[] = [];
  const E = (
    date: string,
    startSlot: number,
    length: number,
    category: 'g' | 'b' | 'r',
    note?: string,
  ): Entry =>
    note === undefined
      ? { date, startSlot, length, category }
      : { date, startSlot, length, category, note };

  for (const [date, d] of Object.entries(DAYS)) {
    entries.push({
      fn: 'entriesFromDay',
      input: { date, doc: d },
      output: entriesFromDay(date, d),
    });
    entries.push({
      fn: 'logicalEntriesForDay',
      input: { days: DAYS, date },
      output: logicalEntriesForDay(DAYS, date),
    });
  }
  const applies: Array<[Entry, Entry | undefined]> = [
    [E('2026-10-18', 10, 2, 'g', 'hello'), undefined],
    [E('2026-10-18', 46, 4, 'b'), undefined],
    [E('2026-12-31', 46, 4, 'r', 'ny'), undefined],
    [E('2026-10-18', 2, 4, 'g'), undefined],
    [E('2026-10-18', 26, 2, 'r', 'x'.repeat(250)), undefined],
    [E('2026-10-17', 18, 2, 'b'), E('2026-10-17', 18, 4, 'g', 'deep')],
    [E('2026-10-19', 5, 1, 'g'), undefined],
  ];
  for (const [e, replace] of applies) {
    const opts = { sleep: SLEEP, tz: ZONE, ...(replace ? { replace } : {}) };
    const input = { days: DAYS, entry: e, replace: replace ?? null, sleep: SLEEP, tz: ZONE };
    entries.push({ fn: 'applyEntry', input, output: applyEntry(DAYS, e, opts) });
    entries.push({
      fn: 'deleteEntry',
      input: { days: DAYS, entry: e },
      output: deleteEntry(DAYS, e),
    });
  }
  for (const s of ['2026-10-18T14:20:00', '2026-10-18T00:00:00', '2026-10-19T00:00:00']) {
    for (const e of [
      E('2026-10-18', 20, 2, 'g'),
      E('2026-10-18', 47, 2, 'g'),
      E('2026-10-18', 30, 1, 'b'),
      E('2026-10-16', 0, 1, 'r'),
      E('2026-10-18', 0, 49, 'g'),
    ]) {
      let out: string | null;
      try {
        out = validateEntry(e, mk(s));
      } catch (err) {
        out = `throw:${(err as Error).message}`;
      }
      entries.push({ fn: 'validateEntry', input: { entry: e, ...nowInput(s) }, output: out });
    }
  }
  for (const text of ['hi', '', 'z'.repeat(1100)]) {
    entries.push({
      fn: 'withReflection',
      input: { doc: DAYS['2026-10-18'], text },
      output: withReflection(DAYS['2026-10-18'], text),
    });
  }
  for (const s of [
    '2026-10-18T14:20:00',
    '2026-10-18T00:20:00',
    '2027-01-01T00:20:00',
    '2026-03-08T03:10:00',
  ]) {
    const now = mk(s);
    for (const category of ['g', 'b', 'r'] as const) {
      const plan = planDrop({
        days: DAYS,
        targets: lastHourWindow(now),
        category,
        sleep: SLEEP,
        tz: ZONE,
        now,
      });
      entries.push({
        fn: 'planDrop',
        input: { days: DAYS, category, sleep: SLEEP, tz: ZONE, ...nowInput(s) },
        output: plan,
      });
      entries.push({
        fn: 'undoDrop',
        input: { days: DAYS, undo: plan.undo },
        output: undoDrop({ ...DAYS, ...plan.changed }, plan.undo),
      });
    }
  }

  const ranges = [
    ['2026-10-17', '2026-10-18'],
    ['2026-12-31', '2027-01-01'],
    ['2026-03-08', '2026-03-09'],
    ['2026-10-10', '2026-10-25'],
  ];
  for (const [start, end] of ranges) {
    const dates: string[] = [];
    for (
      let d = new Date(start + 'T00:00:00Z');
      d <= new Date(end + 'T00:00:00Z');
      d = new Date(d.getTime() + 864e5)
    )
      dates.push(d.toISOString().slice(0, 10));
    for (const s of ['2026-10-18T14:20:00', '2027-01-01T12:00:00']) {
      const st = computeStats({ dates, days: DAYS, settingsSleep: SLEEP, now: mk(s) });
      stats.push({
        fn: 'computeStats',
        input: { dates, days: DAYS, settingsSleep: SLEEP, ...nowInput(s) },
        output: st,
      });
    }
    const range = { start, end };
    exp.push({ fn: 'exportRows', input: { days: DAYS, range }, output: exportRows(DAYS, range) });
    exp.push({ fn: 'toCsv', input: { days: DAYS, range }, output: toCsv(DAYS, range) });
    const meta = { exportedAt: '2026-10-18T14:20:00.000Z', timezone: ZONE };
    exp.push({
      fn: 'toJson',
      input: { days: DAYS, range, meta },
      output: toJson(DAYS, range, meta),
    });
    exp.push({
      fn: 'exportCounts',
      input: { days: DAYS, range },
      output: exportCounts(DAYS, range),
    });
    for (const f of ['csv', 'json'] as const)
      exp.push({
        fn: 'exportFilename',
        input: { range, format: f },
        output: exportFilename(range, f),
      });
  }
  for (const n of [0, 0.5, 1.5, 2.5, 33.333, 99.5, 100])
    stats.push({ fn: 'roundPct', input: { n }, output: roundPct(n) });
  for (const v of ['plain', 'a,b', 'q"uote', 'line\nbreak', 'x\ry', 42, ''])
    exp.push({ fn: 'csvField', input: { v }, output: csvField(v) });
  exp.push({ fn: 'CSV_HEADER', input: {}, output: CSV_HEADER });
  for (const s of ['2026-10-18T14:20:00', '2026-03-08T03:10:00', '2026-11-01T01:30:00']) {
    exp.push({ fn: 'isoWithOffset', input: nowInput(s), output: isoWithOffset(mk(s)) });
  }

  writeGolden('entries', entries);
  writeGolden('stats', stats);
  writeGolden('export', exp);
});
