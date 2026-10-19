// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  vi.unstubAllGlobals();
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

  describe('reminders', () => {
    const stubNotification = (permission: NotificationPermission) => {
      const requestPermission = vi.fn(async () => permission);
      vi.stubGlobal('Notification', { permission: 'default', requestPermission });
      return requestPermission;
    };

    it('is off by default', async () => {
      stubNotification('granted');
      setup();
      const toggle = (await screen.findByRole('switch', {
        name: 'Hourly notification while app is open',
      })) as HTMLInputElement;
      expect(toggle.checked).toBe(false);
      expect(screen.getByText(/phones may pause background tabs/)).toBeTruthy();
    });

    it('turns on when permission is granted and persists the choice locally', async () => {
      const request = stubNotification('granted');
      (globalThis.Notification as { permission: string }).permission = 'granted';
      const save = setup();
      const toggle = (await screen.findByRole('switch')) as HTMLInputElement;
      fireEvent.click(toggle);
      expect(request).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toggle.checked).toBe(true));
      expect(localStorage.getItem('marbles-hourly-notify')).toBe('1');
      expect(save).not.toHaveBeenCalled();
      fireEvent.click(toggle);
      await waitFor(() => expect(toggle.checked).toBe(false));
      expect(localStorage.getItem('marbles-hourly-notify')).toBeNull();
    });

    it('stays off and explains when permission is denied', async () => {
      stubNotification('denied');
      setup();
      const toggle = (await screen.findByRole('switch')) as HTMLInputElement;
      fireEvent.click(toggle);
      expect((await screen.findByRole('alert')).textContent).toContain('blocked');
      expect(toggle.checked).toBe(false);
      expect(localStorage.getItem('marbles-hourly-notify')).toBeNull();
    });

    it('stays off and explains when notifications are unsupported', async () => {
      vi.stubGlobal('Notification', undefined);
      setup();
      const toggle = (await screen.findByRole('switch')) as HTMLInputElement;
      fireEvent.click(toggle);
      expect((await screen.findByRole('alert')).textContent).toContain("doesn't support");
      expect(toggle.checked).toBe(false);
    });

    it('downloads an .ics file from the calendar button', async () => {
      stubNotification('default');
      const createObjectURL = vi.fn(() => 'blob:x');
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      setup();
      fireEvent.click(
        await screen.findByRole('button', { name: 'Add hourly reminders to calendar (.ics)' }),
      );
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      expect(blob.type).toContain('text/calendar');
      expect(click).toHaveBeenCalled();
      click.mockRestore();
    });
  });
});
