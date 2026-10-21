// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import ThemeSync from './ThemeSync.tsx';
import { THEME_STORAGE_KEY, applyTheme, readStoredTheme, resolveTheme } from './theme';

let dark = false;
let listener: (() => void) | null = null;

beforeEach(() => {
  dark = false;
  listener = null;
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = `
    <meta name="theme-color" content="#fff8f3" media="(prefers-color-scheme: light)" data-scheme="light" />
    <meta name="theme-color" content="#1d1a2b" media="(prefers-color-scheme: dark)" data-scheme="dark" />`;
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, cb: () => void) => (listener = cb),
    removeEventListener: () => (listener = null),
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const theme = () => document.documentElement.getAttribute('data-theme');

describe('applyTheme', () => {
  it('resolves system from prefers-color-scheme', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    dark = true;
    applyTheme('system');
    expect(theme()).toBe('dark');
  });

  it('sets data-theme, mirrors the choice into localStorage and syncs theme-color', () => {
    applyTheme('dark');
    expect(theme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect([...metas].every((m) => m.content === '#1d1a2b' && m.media === 'all')).toBe(true);

    applyTheme('system');
    expect(metas[0].media).toBe('(prefers-color-scheme: light)');
    expect(metas[1].content).toBe('#1d1a2b');
    applyTheme('light');
    expect(theme()).toBe('light');
  });

  it('ignores a bad stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('system');
  });
});

describe('ThemeSync', () => {
  const auth: AuthBackend = {
    subscribe(cb) {
      queueMicrotask(() => cb({ uid: 'u1', email: null, displayName: null }));
      return () => {};
    },
    signInWithGoogle: async () => {},
    signInWithEmail: async () => {},
    signUpWithEmail: async () => {},
    resetPassword: async () => {},
    signOut: async () => {},
  };
  const repoWith = (settings: Settings): Repo => ({
    subscribeSettings(_u, cb) {
      queueMicrotask(() => cb(settings));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays: () => () => {},
    getDays: async () => ({}),
    writeDays: async () => {},
    deleteAllData: async () => ({ deletedDays: 0 }),
  });
  const mount = (settings: Settings) =>
    render(
      <AuthProvider backend={auth}>
        <RepoProvider repo={repoWith(settings)}>
          <ThemeSync />
        </RepoProvider>
      </AuthProvider>,
    );

  it('applies the saved theme to <html>', async () => {
    mount({ ...DEFAULT_SETTINGS, theme: 'dark' });
    await vi.waitFor(() => expect(theme()).toBe('dark'));
  });

  it('follows the system setting live when the theme is system', async () => {
    mount(DEFAULT_SETTINGS);
    await vi.waitFor(() => expect(theme()).toBe('light'));
    dark = true;
    act(() => listener?.());
    expect(theme()).toBe('dark');
  });
});
