// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function fakeRepo(initial: Record<string, DayDoc> = {}) {
  const writeDays = vi.fn<Repo['writeDays']>(async () => {});
  const repo: Repo = {
    subscribeSettings(_uid, cb) {
      queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays(_uid, start, end, cb) {
      queueMicrotask(() =>
        cb(Object.fromEntries(Object.entries(initial).filter(([k]) => k >= start && k <= end))),
      );
      return () => {};
    },
    writeDays,
  };
  return { repo, writeDays };
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
    fireEvent.click(await screen.findByRole('button', { name: 'Log time' }));
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

  it('disables logging for a future day', async () => {
    const { repo } = fakeRepo();
    renderDay(repo, '/day/2026-10-20');
    const btn = await screen.findByRole('button', { name: 'Log time' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
