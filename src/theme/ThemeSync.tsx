import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useSettings } from '../data/RepoProvider.tsx';
import { applyTheme, watchSystemTheme } from './theme';

/** Applies the signed-in user's saved theme; renders nothing. */
export default function ThemeSync() {
  const { user } = useAuth();
  const { settings, loading } = useSettings(user?.uid);
  const pref = settings.theme;

  useEffect(() => {
    if (loading) return;
    applyTheme(pref);
    if (pref !== 'system') return;
    return watchSystemTheme(() => applyTheme(pref));
  }, [pref, loading]);

  return null;
}
