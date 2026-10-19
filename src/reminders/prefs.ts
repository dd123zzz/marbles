import { useSyncExternalStore } from 'react';

/** Device-specific, so it lives in localStorage and not in the synced Settings doc. */
export const HOURLY_KEY = 'marbles-hourly-notify';
const CHANGE_EVENT = 'marbles-reminder-pref';

export function getHourlyPref(): boolean {
  try {
    return localStorage.getItem(HOURLY_KEY) === '1';
  } catch {
    return false;
  }
}

export function setHourlyPref(on: boolean): void {
  try {
    if (on) localStorage.setItem(HOURLY_KEY, '1');
    else localStorage.removeItem(HOURLY_KEY);
  } catch {
    // storage unavailable: the preference just won't persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useHourlyPref(): boolean {
  return useSyncExternalStore(subscribe, getHourlyPref, () => false);
}
