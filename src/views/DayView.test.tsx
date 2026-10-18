// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import DayView from './DayView.tsx';

const auth: AuthBackend = {
  subscribe(cb) {
    queueMicrotask(() => cb({ uid: 'u1', email: 'a@b.c', displayName: null }));
    return () => {};
  },
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
};

function fakeRepo(
  initial: Record<string, DayDoc> = {},
  opts: { cacheOnly?: boolean; holdSettings?: boolean } = {},
) {
  const dayListeners = new Set<() => void>();
  let fromCache = opts.cacheOnly ?? false;
  let settingsCb: ((s: typeof DEFAULT_SETTINGS) => void) | null = null;
  const writeDays = vi.fn<Repo['writeDays']>(async () => {});
  const repo: Repo = {
    subscribeSettings(_uid, cb) {
      if (opts.holdSettings) settingsCb = cb;
      else queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays(_uid, start, end, cb) {
      const emit = () =>
        cb(Object.fromEntries(Object.entries(initial).filter(([k]) => k >= start && k <= end)), {
          fromCache,
        });
      dayListeners.add(emit);
      queueMicrotask(emit);
      return () => {
        dayListeners.delete(emit);
      };
    },
    writeDays,
  };
  return {
    repo,
    writeDays,
    serverArrives: () => {
      fromCache = false;
      dayListeners.forEach((f) => f());
    },
    loadSettings: () => settingsCb?.(DEFAULT_SETTINGS),
    settingsRequested: () => settingsCb !== null,
  };
}

function renderDay(repo: Repo, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider backend={auth}>
        <RepoProvider repo={repo}>
          <Routes>
            <Route path="/" element={<DayView />} />
            <Route path="/day/:date" element={<DayView />} />
          </Routes>
        </RepoProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function openLogSheet() {
  const btn = (await screen.findByRole('button', { name: 'Log time' })) as HTMLButtonElement;
  await vi.waitFor(() => expect(btn.disabled).toBe(false));
  fireEvent.click(btn);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 14, 20));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DayView', () => {
  it('logs the previous hour as Wanted in two taps', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await openLogSheet();
    const wanted = await screen.findByRole('button', { name: 'Wanted' });
    await vi.waitFor(() => expect((wanted as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(wanted);

    expect(writeDays).toHaveBeenCalledTimes(1);
    const [uid, docs] = writeDays.mock.calls[0];
    expect(uid).toBe('u1');
    expect(Object.keys(docs)).toEqual(['2026-10-14']);
    expect(docs['2026-10-14'].slots.slice(24, 30)).toBe('..gg..');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the edit sheet for a logged marble and deletes with confirmation', async () => {
    const slots = '.'.repeat(26) + 'gg' + '.'.repeat(20);
    const doc: DayDoc = {
      slots,
      notes: { '26': 'reading' },
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDay(repo);
    fireEvent.click(await screen.findByLabelText('13:00–14:00 Wanted'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Note (optional)') as HTMLInputElement).value).toBe('reading');
    const del = screen.getByRole('button', { name: 'Delete' });
    await vi.waitFor(() => expect((del as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(del);
    expect(writeDays.mock.calls[0][1]['2026-10-14'].slots).toBe('.'.repeat(48));
  });

  it('does not save from a cache-only snapshot until the server answers', async () => {
    const { repo, writeDays, serverArrives } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    expect(await screen.findByText('Syncing…')).toBeTruthy();
    expect(wanted.disabled).toBe(true);
    serverArrives();
    await vi.waitFor(() => expect(wanted.disabled).toBe(false));
    expect(screen.queryByText('Syncing…')).toBeNull();
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
  });

  it('allows saving from the cache when offline', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { repo, writeDays } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    await vi.waitFor(() => expect(wanted.disabled).toBe(false));
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
    online.mockRestore();
  });

  it('allows saving from the cache after the grace period', async () => {
    const { repo, writeDays } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    expect(wanted.disabled).toBe(true);
    await vi.waitFor(() => expect(wanted.disabled).toBe(false), { timeout: 6000 });
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
  }, 10000);

  it('disables Log time until settings have loaded', async () => {
    const { repo, loadSettings, settingsRequested } = fakeRepo({}, { holdSettings: true });
    renderDay(repo);
    const btn = (await screen.findByRole('button', { name: 'Log time' })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await vi.waitFor(() => expect(settingsRequested()).toBe(true));
    act(() => loadSettings());
    await vi.waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('disables logging for a future day', async () => {
    const { repo } = fakeRepo();
    renderDay(repo, '/day/2026-10-20');
    const btn = await screen.findByRole('button', { name: 'Log time' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
