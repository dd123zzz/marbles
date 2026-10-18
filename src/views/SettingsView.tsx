import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useRepo, useSettings } from '../data/RepoProvider.tsx';
import type { Settings, WeekStart } from '../types';
import { startOptions } from './logSheetLogic';

const TIME_OPTIONS = startOptions();

export default function SettingsView() {
  const { user } = useAuth();
  const { settings, loading } = useSettings(user?.uid);
  return (
    <div>
      <h1>Settings</h1>
      {loading || !user ? <p>Loading…</p> : <SettingsForm uid={user.uid} initial={settings} />}
      <AccountSection />
    </div>
  );
}

function SettingsForm({ uid, initial }: { uid: string; initial: Settings }) {
  const repo = useRepo();
  const [sleepStart, setSleepStart] = useState(initial.sleepStart);
  const [sleepEnd, setSleepEnd] = useState(initial.sleepEnd);
  const [weekStart, setWeekStart] = useState<WeekStart>(initial.weekStart);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setStatus('idle');
    };

  const save = () => {
    // not awaited: works offline and syncs later
    repo.saveSettings(uid, { sleepStart, sleepEnd, weekStart }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    });
    setStatus('saved');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="field">
        Sleep start
        <select value={sleepStart} onChange={(e) => edit(setSleepStart)(e.target.value)}>
          {TIME_OPTIONS.map((o) => (
            <option key={o.label} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Sleep end
        <select value={sleepEnd} onChange={(e) => edit(setSleepEnd)(e.target.value)}>
          {TIME_OPTIONS.map((o) => (
            <option key={o.label} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        Changing your sleep window affects only days you haven&apos;t logged yet.
      </p>

      <fieldset>
        <legend>Week starts on</legend>
        {(['mon', 'sun'] as const).map((w) => (
          <label key={w} className="inline">
            <input
              type="radio"
              name="weekStart"
              value={w}
              checked={weekStart === w}
              onChange={() => edit(setWeekStart)(w)}
            />
            {w === 'mon' ? 'Monday' : 'Sunday'}
          </label>
        ))}
      </fieldset>

      <button type="submit" className="primary">
        Save
      </button>
      {status === 'saved' && <span role="status"> Saved</span>}
      {status === 'error' && (
        <span role="alert" className="error">
          {' '}
          Could not save: {error}
        </span>
      )}
    </form>
  );
}

function AccountSection() {
  const { user, signOut } = useAuth();
  return (
    <section>
      <h2>Account</h2>
      <p>{user?.email ?? user?.displayName ?? user?.uid}</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </section>
  );
}
