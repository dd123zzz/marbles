import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider.tsx';
import SignInView from './SignInView.tsx';

/** Renders children for signed-in users, otherwise the sign-in form (deep links survive sign-in). */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  if (!user) return <SignInView />;
  return children;
}
