import type { ThemePref } from '../types';

export const THEME_STORAGE_KEY = 'marbles-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLOR = { light: '#fff8f3', dark: '#1d1a2b' } as const;

export type ResolvedTheme = 'light' | 'dark';

export function isThemePref(v: unknown): v is ThemePref {
  return v === 'system' || v === 'light' || v === 'dark';
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(pref: ThemePref, prefersDark = systemPrefersDark()): ResolvedTheme {
  return pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;
}

export function readStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePref(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Sets data-theme on <html> (always the resolved light or dark), mirrors the choice into
 * localStorage for the pre-paint script in index.html, and keeps theme-color in sync.
 */
export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // storage may be unavailable (private mode); the theme still applies for this session
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.dataset.scheme === 'dark' ? 'dark' : 'light';
    if (pref === 'system') {
      meta.media = `(prefers-color-scheme: ${scheme})`;
      meta.content = THEME_COLOR[scheme];
    } else {
      meta.media = 'all';
      meta.content = THEME_COLOR[pref];
    }
  });
  return resolved;
}

/** Re-applies the theme whenever the OS color scheme changes. Returns an unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
