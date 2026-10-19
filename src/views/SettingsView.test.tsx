// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS } from '../types';
import SettingsView from './SettingsView.tsx';

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

function setup(saveSettings: Repo['saveSettings'] = async () => {}) {
  const save = vi.fn(saveSettings);
  const repo: Repo = {
    subscribeSettings(_uid, cb) {
      queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: save,
    subscribeDays: () => () => {},
    getDays: async () => ({}),
    writeDays: async () => {},
  };
  render(
    <MemoryRouter>
      <AuthProvider backend={auth}>
        <RepoProvider repo={repo}>
          <ToastProvider>
            <SettingsView />
          </ToastProvider>
        </RepoProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return save;
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('SettingsView', () => {
  it('has a 3-way theme control that saves and applies data-theme', async () => {
    const save = setup();
    const dark = (await screen.findByLabelText('Dark')) as HTMLInputElement;
    expect((screen.getByLabelText('System') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(dark);
    expect(save).toHaveBeenCalledWith('u1', { theme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('marbles-theme')).toBe('dark');
    expect(dark.checked).toBe(true);
  });

  it('reverts and toasts when saving the theme fails', async () => {
    setup(async () => {
      throw new Error('denied');
    });
    fireEvent.click(await screen.findByLabelText('Dark'));
    expect((await screen.findByRole('alert')).textContent).toContain('denied');
    expect((screen.getByLabelText('System') as HTMLInputElement).checked).toBe(true);
  });

  it('confirms saved settings with a toast', async () => {
    const save = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledWith('u1', {
      sleepStart: '23:00',
      sleepEnd: '07:00',
      weekStart: 'mon',
    });
    expect(screen.getByRole('status').textContent).toContain('Settings saved');
  });
});
