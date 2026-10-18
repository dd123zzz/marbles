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
});
