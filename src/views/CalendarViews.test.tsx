// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import MonthView from './MonthView.tsx';
import WeekView from './WeekView.tsx';

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

const doc = (slots: string): DayDoc => ({
  slots,
  notes: {},
  sleep: { start: '23:00', end: '07:00' },
  tz: 'America/Los_Angeles',
  v: 1,
});

const LOGGED = '.'.repeat(26) + 'gg' + '.'.repeat(20);

function fakeRepo(initial: Record<string, DayDoc>): Repo {
  return {
    subscribeSettings(_uid, cb) {
      queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays(_uid, start, end, cb) {
      queueMicrotask(() =>
        cb(Object.fromEntries(Object.entries(initial).filter(([k]) => k >= start && k <= end)), {
          fromCache: false,
        }),
      );
      return () => {};
    },
    getDays: async () => ({}),
    writeDays: async () => {},
    deleteAllData: async () => ({ deletedDays: 0 }),
  };
}

function renderAt(repo: Repo, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider backend={auth}>
        <RepoProvider repo={repo}>
          <ToastProvider>
            <Routes>
              <Route path="/week/:date" element={<WeekView />} />
              <Route path="/month/:ym" element={<MonthView />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const jar = (name: RegExp) => screen.getByRole('img', { name });
const marbleCount = (el: Element) => el.querySelectorAll('.marble').length;

beforeEach(() => {
  // Wed Oct 14 2026, 12:00 local
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each([
  ['WeekView', '/week/2026-10-14'],
  ['MonthView', '/month/2026-10'],
])('%s empty jars for unlogged past days', (_name, path) => {
  const repo = () =>
    fakeRepo({
      '2026-10-12': doc('.'.repeat(48)),
      '2026-10-13': doc(LOGGED),
    });

  it('draws no marbles for a past day with nothing logged', async () => {
    renderAt(repo(), path);
    const allDots = await screen.findByRole('img', { name: 'Mon Oct 12: nothing logged' });
    expect(marbleCount(allDots)).toBe(0);
  });

  it('keeps the normal jar for a past day with a logged slot', async () => {
    renderAt(repo(), path);
    const logged = await screen.findByRole('img', { name: /^Tue Oct 13: G 1h/ });
    expect(marbleCount(logged)).toBeGreaterThanOrEqual(24);
  });

  it('keeps the normal jar for today and future days', async () => {
    renderAt(repo(), path);
    const today = await screen.findByRole('img', { name: /^Wed Oct 14: G 0h/ });
    expect(marbleCount(today)).toBeGreaterThanOrEqual(24);
    const future = jar(/^Thu Oct 15: /);
    expect(marbleCount(future)).toBeGreaterThanOrEqual(24);
    expect(future.getAttribute('aria-label')).not.toMatch(/nothing logged/);
  });

  it('treats a day with no doc as nothing logged', async () => {
    renderAt(fakeRepo({}), path);
    const noDoc = await screen.findByRole('img', { name: 'Mon Oct 12: nothing logged' });
    expect(marbleCount(noDoc)).toBe(0);
    expect(noDoc.querySelector('.jar-outline')).not.toBeNull();
  });
});
