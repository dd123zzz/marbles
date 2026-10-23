// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import ExportView from './ExportView.tsx';
import StatsView from './StatsView.tsx';

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

const day = (slots: string): DayDoc => ({
  slots,
  notes: { '20': 'hello' },
  sleep: { start: '23:00', end: '07:00' },
  tz: 'America/Los_Angeles',
  v: 1,
});

function fakeRepo(initial: Record<string, DayDoc>, getDays?: Repo['getDays']) {
  const repo: Repo = {
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
    getDays:
      getDays ??
      (async (_uid, start, end) =>
        Object.fromEntries(Object.entries(initial).filter(([k]) => k >= start && k <= end))),
    writeDays: async () => {},
    deleteAllData: async () => ({ deletedDays: 0 }),
  };
  return repo;
}

function renderAt(repo: Repo, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider backend={auth}>
        <RepoProvider repo={repo}>
          <ToastProvider>
            <Routes>
              <Route path="/stats/:period/:date" element={<StatsView />} />
              <Route path="/export" element={<ExportView />} />
              <Route path="/" element={<p>home</p>} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StatsView', () => {
  it('shows hours and percentages and toggles the basis', async () => {
    const slots = '.'.repeat(20) + 'gggg' + 'pp' + '.'.repeat(22);
    renderAt(fakeRepo({ '2020-06-10': day(slots) }), '/stats/day/2020-06-10');
    const row = await screen.findByRole('row', { name: /Productive/ });
    expect(row.textContent).toContain('2h');
    expect(row.textContent).toContain('12.5%'); // 2 of 16 awake hours
    const purposeful = screen.getByRole('row', { name: /Purposeful/ });
    expect(purposeful.textContent).toContain('1h');
    expect(purposeful.textContent).toContain('6.3%'); // 1 of 16 awake hours
    expect(screen.queryByRole('row', { name: /Sleep/ })).toBeNull();
    fireEvent.click(screen.getByLabelText('Of 24 hours'));
    const wanted = screen.getByRole('row', { name: /Productive/ });
    expect(wanted.textContent).toContain('8.3%');
    expect(screen.getByRole('row', { name: /Purposeful/ }).textContent).toContain('4.2%');
    expect(screen.getByRole('row', { name: /Sleep/ }).textContent).toContain('8h');
  });

  it('shows an empty state when nothing is logged', async () => {
    renderAt(fakeRepo({}), '/stats/week/2020-06-10');
    expect(await screen.findByText('No data yet')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('redirects on invalid params', async () => {
    renderAt(fakeRepo({}), '/stats/year/2020-06-10');
    expect(await screen.findByText('home')).toBeTruthy();
  });
});

describe('ExportView', () => {
  it('shows an empty state before the first download', async () => {
    renderAt(fakeRepo({}), '/export');
    expect(await screen.findByText(/Nothing exported yet/)).toBeTruthy();
  });

  it('downloads and reports counts', async () => {
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt(fakeRepo({ '2020-06-10': day('.'.repeat(20) + 'gggg' + '.'.repeat(24)) }), '/export');
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByText('1 day, 1 entry exported')).toBeTruthy();
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });

  it('shows errors inline', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    renderAt(
      fakeRepo({}, async () => {
        throw new Error('boom');
      }),
      '/export',
    );
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect((await screen.findByRole('alert')).textContent).toContain('boom');
  });
});
