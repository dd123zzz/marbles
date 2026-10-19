import { DEFAULT_SETTINGS, type DateKey, type DayDoc, type Settings } from '../types.ts';
import type { Repo, Unsubscribe } from './repo.ts';

const STORAGE_KEY = 'marbles-demo';

interface UserData {
  settings?: Settings;
  days: Record<DateKey, DayDoc>;
}
type Store = Record<string, UserData>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function persist(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable: keep working in memory
  }
}

export function createMemoryRepo(): Repo {
  const store = load();
  const listeners = new Set<() => void>();

  const user = (uid: string): UserData => (store[uid] ??= { days: {} });
  const notify = () => {
    // async like Firestore, and re-checked so unsubscribed listeners never fire
    for (const fn of [...listeners]) queueMicrotask(() => listeners.has(fn) && fn());
  };
  const subscribe = (emit: () => void): Unsubscribe => {
    listeners.add(emit);
    queueMicrotask(() => listeners.has(emit) && emit());
    return () => {
      listeners.delete(emit);
    };
  };

  return {
    subscribeSettings(uid, cb) {
      return subscribe(() => cb({ ...DEFAULT_SETTINGS, ...user(uid).settings, v: 1 }));
    },

    async saveSettings(uid, patch) {
      const u = user(uid);
      u.settings = { ...DEFAULT_SETTINGS, ...u.settings, ...definedOnly(patch), v: 1 };
      persist(store);
      notify();
    },

    subscribeDays(uid, start, end, cb) {
      return subscribe(() => {
        const out: Record<DateKey, DayDoc> = {};
        for (const [date, day] of Object.entries(user(uid).days)) {
          if (date >= start && date <= end) out[date] = structuredClone(day);
        }
        cb(out, { fromCache: false });
      });
    },

    async getDays(uid, start, end) {
      const out: Record<DateKey, DayDoc> = {};
      for (const [date, day] of Object.entries(user(uid).days)) {
        if (date >= start && date <= end) out[date] = structuredClone(day);
      }
      return out;
    },

    async writeDays(uid, days) {
      const u = user(uid);
      for (const [date, day] of Object.entries(days)) u.days[date] = structuredClone(day);
      persist(store);
      notify();
    },
  };
}

function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
