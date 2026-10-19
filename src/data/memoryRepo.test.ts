import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type DayDoc } from '../types.ts';
import { createMemoryRepo } from './memoryRepo.ts';

const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
});

const day = (slots = '.'.repeat(48)): DayDoc => ({
  slots,
  notes: {},
  sleep: { start: '23:00', end: '07:00' },
  tz: 'UTC',
  v: 1,
});
const tick = () => new Promise<void>((r) => setTimeout(r));

describe('memoryRepo', () => {
  it('emits defaults for missing settings and merges patches', async () => {
    const repo = createMemoryRepo();
    const seen: unknown[] = [];
    repo.subscribeSettings('u', (s) => seen.push(s));
    await tick();
    expect(seen[0]).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings('u', { weekStart: 'sun' });
    await tick();
    expect(seen.at(-1)).toEqual({ ...DEFAULT_SETTINGS, weekStart: 'sun' });
  });

  it('returns an inclusive date range and notifies after writes', async () => {
    const repo = createMemoryRepo();
    const seen: string[][] = [];
    repo.subscribeDays('u', '2026-03-01', '2026-03-31', (d) => seen.push(Object.keys(d).sort()));
    await repo.writeDays('u', {
      '2026-02-28': day(),
      '2026-03-01': day(),
      '2026-03-31': day(),
      '2026-04-01': day(),
    });
    await tick();
    expect(seen.at(-1)).toEqual(['2026-03-01', '2026-03-31']);
  });

  it('never reports fromCache', async () => {
    const repo = createMemoryRepo();
    const metas: boolean[] = [];
    repo.subscribeDays('u', '2026-03-01', '2026-03-31', (_d, m) => metas.push(m.fromCache));
    await repo.writeDays('u', { '2026-03-02': day() });
    await tick();
    expect(metas.length).toBeGreaterThan(0);
    expect(metas.every((m) => m === false)).toBe(true);
  });

  it('does not notify after unsubscribe', async () => {
    const repo = createMemoryRepo();
    const cb = vi.fn();
    const off = repo.subscribeDays('u', '2026-03-01', '2026-03-31', cb);
    off();
    await repo.writeDays('u', { '2026-03-02': day() });
    await tick();
    expect(cb).not.toHaveBeenCalled();
  });

  it('persists to localStorage across instances', async () => {
    await createMemoryRepo().writeDays('u', { '2026-03-02': day('g'.repeat(48)) });
    const seen: string[] = [];
    createMemoryRepo().subscribeDays('u', '2026-03-02', '2026-03-02', (d) =>
      seen.push(d['2026-03-02'].slots),
    );
    await tick();
    expect(seen).toEqual(['g'.repeat(48)]);
  });

  it('getDays reads an inclusive range once', async () => {
    const repo = createMemoryRepo();
    await repo.writeDays('u', { '2026-03-01': day(), '2026-03-05': day(), '2026-03-09': day() });
    const out = await repo.getDays('u', '2026-03-01', '2026-03-05');
    expect(Object.keys(out).sort()).toEqual(['2026-03-01', '2026-03-05']);
    expect(await repo.getDays('other', '1970-01-01', '2999-01-01')).toEqual({});
  });

  it('deleteAllData clears days and settings, notifies subscribers and returns the count', async () => {
    const repo = createMemoryRepo();
    await repo.writeDays('u', { '2026-03-02': day(), '2026-03-03': day() });
    await repo.writeDays('other', { '2026-03-02': day() });
    await repo.saveSettings('u', { weekStart: 'sun' });
    const days: string[][] = [];
    const settings: unknown[] = [];
    repo.subscribeDays('u', '2026-03-01', '2026-03-31', (d) => days.push(Object.keys(d)));
    repo.subscribeSettings('u', (s) => settings.push(s));
    await tick();
    expect(days.at(-1)).toHaveLength(2);

    expect(await repo.deleteAllData?.('u')).toEqual({ deletedDays: 2 });
    await tick();
    expect(days.at(-1)).toEqual([]);
    expect(settings.at(-1)).toEqual(DEFAULT_SETTINGS);
    expect(await repo.getDays('u', '2026-03-01', '2026-03-31')).toEqual({});
    expect(Object.keys(await repo.getDays('other', '2026-03-01', '2026-03-31'))).toHaveLength(1);
    expect(JSON.parse(mem.get('marbles-demo') ?? '{}').u).toBeUndefined();
    expect(await repo.deleteAllData?.('u')).toEqual({ deletedDays: 0 });
  });
});
