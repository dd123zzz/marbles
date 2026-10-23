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

describe('MonthView empty jars for unlogged past days', () => {
  const path = '/month/2026-10';
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
    const logged = await screen.findByRole('img', {
      name: /^Tue Oct 13: Purposeful 0h · Productive 1h/,
    });
    expect(marbleCount(logged)).toBeGreaterThanOrEqual(24);
  });

  it('keeps the normal jar for today and future days', async () => {
    renderAt(repo(), path);
    const today = await screen.findByRole('img', {
      name: /^Wed Oct 14: Purposeful 0h · Productive 0h/,
    });
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

describe('WeekView timeline', () => {
  const path = '/week/2026-10-14';
  const repo = () =>
    fakeRepo({
      '2026-10-12': doc('.'.repeat(48)),
      '2026-10-13': doc(LOGGED),
    });

  it('announces a loading status while the week loads', async () => {
    const pending: Repo = { ...repo(), subscribeDays: () => () => {} };
    renderAt(pending, path);
    const status = await screen.findByText('Loading week…');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.className).toContain('sr-only');
  });

  it('shows a nothing-logged column with no segments', async () => {
    renderAt(repo(), path);
    const link = await screen.findByRole('link', { name: 'Mon Oct 12: nothing logged' });
    expect(link.textContent).toContain('Nothing logged');
    expect(link.querySelectorAll('.wt-seg')).toHaveLength(0);
  });

  it('draws logged segments and links to the day', async () => {
    renderAt(repo(), path);
    const link = await screen.findByRole('link', { name: /^Tue Oct 13: Productive 1h/ });
    expect(link.querySelector('.wt-seg.c-g')).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/day/2026-10-13');
  });

  it('marks today with a now line and a future run', async () => {
    renderAt(repo(), path);
    const link = await screen.findByRole('link', { name: /, today/ });
    expect(link.querySelector('.wt-now')).not.toBeNull();
    expect(link.querySelector('.wt-seg.c-empty')).not.toBeNull();
  });

  it('draws a future day as one dashed segment and keeps it tappable', async () => {
    renderAt(repo(), path);
    const link = await screen.findByRole('link', { name: 'Thu Oct 15: not yet' });
    expect(link.querySelectorAll('.c-empty')).toHaveLength(1);
    expect(link.querySelectorAll('.wt-seg')).toHaveLength(1);
    expect(link.getAttribute('href')).toBe('/day/2026-10-15');
  });

  it('links to week stats and shows week hours in the legend', async () => {
    renderAt(repo(), path);
    const stats = await screen.findByRole('link', { name: /Week stats/ });
    expect(stats.getAttribute('href')).toBe('/stats/week/2026-10-12');
    expect(screen.getByText('Productive 1h')).toBeTruthy();
  });

  it('drops the Week/Month switch links but keeps the other header controls', async () => {
    renderAt(repo(), path);
    await screen.findByRole('link', { name: /Week stats/ });
    expect(screen.queryByRole('link', { name: 'Month' })).toBeNull();
    expect(screen.getByRole('link', { name: 'This week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Share/ })).toBeTruthy();
    cleanup();
    renderAt(repo(), '/month/2026-10');
    await screen.findByRole('link', { name: 'This month' });
    expect(screen.queryByRole('link', { name: 'Week' })).toBeNull();
  });
});
