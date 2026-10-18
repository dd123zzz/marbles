import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider.tsx';

export default function SignInView() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success?: string) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await action();
      if (success) setInfo(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void run(() =>
      mode === 'signin'
        ? auth.signInWithEmail(email.trim(), password)
        : auth.signUpWithEmail(email.trim(), password),
    );
  }

  function onForgot() {
    if (!email.trim()) {
      setInfo(null);
      setError('Enter your email above first, then press "Forgot password?".');
      return;
    }
    void run(
      () => auth.resetPassword(email.trim()),
      `If an account exists for ${email.trim()}, a password reset email is on its way.`,
    );
  }

  return (
    <main>
      <h1>Marbles</h1>
      <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>

      <button type="button" disabled={busy} onClick={() => void run(auth.signInWithGoogle)}>
        Continue with Google
      </button>

      <p>or</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            Email{' '}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </p>
        <p>
          <label>
            Password{' '}
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </p>
        <button type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {info && <p role="status">{info}</p>}

      <p>
        {mode === 'signin' && (
          <>
            <button type="button" disabled={busy} onClick={onForgot}>
              Forgot password?
            </button>{' '}
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'signin' ? 'Create account' : 'Have an account? Sign in'}
        </button>
      </p>
    </main>
  );
}
