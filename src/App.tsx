import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import RequireAuth from './auth/RequireAuth.tsx';
import SignInView from './auth/SignInView.tsx';
import { RepoProvider } from './data/RepoProvider.tsx';

// Placeholders: swap each element for the real view when it exists.
function Placeholder({ name }: { name: string }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <p>{name} (placeholder)</p>
      <p>
        Signed in as {user?.email ?? user?.uid}{' '}
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </p>
    </>
  );
}

function Guarded({ name }: { name: string }): ReactNode {
  return (
    <RequireAuth>
      <Placeholder name={name} />
    </RequireAuth>
  );
}

function SignInRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  return user ? <Navigate to="/" replace /> : <SignInView />;
}

export default function App() {
  return (
    <AuthProvider>
      <RepoProvider>
        <Routes>
          <Route path="/signin" element={<SignInRoute />} />
          <Route path="/" element={<Guarded name="Day view (today)" />} />
          <Route path="/day/:date" element={<Guarded name="Day view" />} />
          <Route path="/week/:date" element={<Guarded name="Week view" />} />
          <Route path="/month/:ym" element={<Guarded name="Month view" />} />
          <Route path="/settings" element={<Guarded name="Settings" />} />
        </Routes>
      </RepoProvider>
    </AuthProvider>
  );
}
