import { useEffect, useState } from 'react';

/** After this long with only cached data we assume we are offline and let the user write. */
const CACHE_GRACE_MS = 4000;

function useOffline(): boolean {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}

/** Text for the error toast shown when a background write is rejected. */
export function writeErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return `Could not save your changes: ${msg}`;
}

/**
 * Decides whether a write may be built from the current snapshot. A partial cache can lack
 * docs that exist on the server, so writing needs a server-confirmed snapshot, an offline
 * device, or the grace period (counted from mount) to have passed. New day docs also need
 * the settings, because the sleep snapshot is permanent.
 */
export function useWriteGate(state: {
  loading: boolean;
  fromCache: boolean;
  settingsLoading: boolean;
}): { daysReady: boolean; writable: boolean } {
  const offline = useOffline();
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), CACHE_GRACE_MS);
    return () => clearTimeout(t);
  }, []);
  const daysReady = !state.loading && (!state.fromCache || offline || graceElapsed);
  return { daysReady, writable: daysReady && !state.settingsLoading };
}
