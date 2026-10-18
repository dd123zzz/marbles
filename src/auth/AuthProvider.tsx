/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createDemoAuth } from './demoAuth.ts';
import type { AuthBackend, AuthContextValue, AuthUser } from './types.ts';

const AuthContext = createContext<AuthContextValue | null>(null);

async function createBackend(): Promise<AuthBackend> {
  if (import.meta.env.VITE_DEMO === 'true') return createDemoAuth();
  // Dynamic import keeps Firebase out of the demo path entirely.
  const { createFirebaseAuth } = await import('./firebaseAuth.ts');
  return createFirebaseAuth();
}

export function AuthProvider({
  children,
  backend: provided,
}: {
  children: ReactNode;
  backend?: AuthBackend;
}) {
  const [backend, setBackend] = useState<AuthBackend | null>(provided ?? null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [resolved, setResolved] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    if (provided) return;
    let cancelled = false;
    createBackend().then(
      (b) => !cancelled && setBackend(b),
      (e: unknown) => !cancelled && setInitError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      cancelled = true;
    };
  }, [provided]);

  useEffect(() => {
    if (!backend) return;
    return backend.subscribe((u) => {
      setUser(u);
      setResolved(true);
    });
  }, [backend]);

  const value = useMemo<AuthContextValue | null>(
    () =>
      backend && {
        user,
        loading: !resolved,
        signInWithGoogle: () => backend.signInWithGoogle(),
        signInWithEmail: (e, p) => backend.signInWithEmail(e, p),
        signUpWithEmail: (e, p) => backend.signUpWithEmail(e, p),
        resetPassword: (e) => backend.resetPassword(e),
        signOut: () => backend.signOut(),
      },
    [backend, user, resolved],
  );

  if (initError) return <p role="alert">Could not start sign-in: {initError.message}</p>;
  if (!value) return <p>Loading…</p>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
