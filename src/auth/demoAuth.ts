import type { AuthBackend, AuthUser } from './types.ts';

const STORAGE_KEY = 'marbles-demo-auth';
const DEMO_USER: AuthUser = { uid: 'demo', email: 'demo@example.com', displayName: 'Demo' };

export function createDemoAuth(): AuthBackend {
  const listeners = new Set<(u: AuthUser | null) => void>();
  const current = (): AuthUser | null => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1' ? DEMO_USER : null;
    } catch {
      return null;
    }
  };
  const set = async (signedIn: boolean) => {
    try {
      if (signedIn) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable: session lasts until reload
    }
    const u = signedIn ? DEMO_USER : null;
    listeners.forEach((fn) => fn(u));
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      queueMicrotask(() => listeners.has(cb) && cb(current()));
      return () => {
        listeners.delete(cb);
      };
    },
    signInWithGoogle: () => set(true),
    signInWithEmail: () => set(true),
    signUpWithEmail: () => set(true),
    resetPassword: async () => {},
    signOut: () => set(false),
  };
}
