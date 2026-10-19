// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS } from '../types';
import Reminders from './Reminders.tsx';

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

const repo: Repo = {
  subscribeSettings(_uid, cb) {
    queueMicrotask(() => cb(DEFAULT_SETTINGS));
    return () => {};
  },
  saveSettings: async () => {},
  subscribeDays(_uid, _s, _e, cb) {
    queueMicrotask(() => cb({}, { fromCache: false }));
    return () => {};
  },
  getDays: async () => ({}),
  writeDays: async () => {},
  deleteAllData: async () => ({ deletedDays: 0 }),
};

function mount(showBanner: boolean) {
  render(
    <AuthProvider backend={auth}>
      <RepoProvider repo={repo}>
        <Reminders showBanner={showBanner} />
      </RepoProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Reminders banner', () => {
  it('shows the unlogged count and can be dismissed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 9, 10));
    mount(true);
    expect((await screen.findByRole('status')).textContent).toContain('2.5 unlogged hours');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss reminder' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is hidden when nothing is unlogged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 5, 0));
    mount(true);
    await act(async () => {});
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is hidden when not on the Day route', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 9, 10));
    mount(false);
    await act(async () => {});
    expect(screen.queryByRole('status')).toBeNull();
  });
});
