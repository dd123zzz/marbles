import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import SegmentedControl from '../components/SegmentedControl.tsx';
import { useToast } from '../components/Toast.tsx';
import { useRepo, useSettings } from '../data/RepoProvider.tsx';
import RemindersSection from '../reminders/RemindersSection.tsx';
import { applyTheme } from '../theme/theme';
import type { Settings, ThemePref, WeekStart } from '../types';
import { startOptions } from './logSheetLogic';
import './forms.css';

const TIME_OPTIONS = startOptions();

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies ReadonlyArray<{ value: ThemePref; label: string }>;

const WEEK_OPTIONS = [
  { value: 'mon', label: 'Monday' },
  { value: 'sun', label: 'Sunday' },
] as const satisfies ReadonlyArray<{ value: WeekStart; label: string }>;

export default function SettingsView() {
  const { user } = useAuth();
  const { settings, loading } = useSettings(user?.uid);
  return (
    <div className="stack">
      <h1>Settings</h1>
      {loading || !user ? (
        <p className="loading">Loading…</p>
      ) : (
        <>
          <ThemeSection uid={user.uid} theme={settings.theme} />
          <SettingsForm uid={user.uid} initial={settings} />
          <RemindersSection settings={settings} />
        </>
      )}
      <section className="card">
        <h2>Data</h2>
        <Link className="link-row" to="/export">
          <span>Export data</span>
          <span aria-hidden="true">›</span>
        </Link>
      </section>
      <AccountSection />
    </div>
  );
}

function ThemeSection({ uid, theme }: { uid: string; theme: ThemePref }) {
  const repo = useRepo();
  const toast = useToast();
  // Shown right away; dropped once the stored value changes or the save fails.
  const [pending, setPending] = useState<{ base: ThemePref; value: ThemePref } | null>(null);
  const value = pending && pending.base === theme ? pending.value : theme;

  const choose = (next: ThemePref) => {
    setPending({ base: theme, value: next });
    applyTheme(next);
    repo.saveSettings(uid, { theme: next }).catch((e: unknown) => {
      setPending(null);
      applyTheme(theme);
      toast.error(`Could not save theme: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  return (
    <section className="card">
      <h2>Appearance</h2>
      <SegmentedControl
        legend="Theme"
        name="theme"
        value={value}
        options={THEME_OPTIONS}
        onChange={choose}
      />
      <p className="muted">System follows your device&apos;s light or dark setting.</p>
    </section>
  );
}

function SettingsForm({ uid, initial }: { uid: string; initial: Settings }) {
  const repo = useRepo();
  const toast = useToast();
  const [sleepStart, setSleepStart] = useState(initial.sleepStart);
  const [sleepEnd, setSleepEnd] = useState(initial.sleepEnd);
  const [weekStart, setWeekStart] = useState<WeekStart>(initial.weekStart);

  const save = () => {
    // not awaited: works offline and syncs later
    repo.saveSettings(uid, { sleepStart, sleepEnd, weekStart }).catch((e: unknown) => {
      toast.error(`Could not save settings: ${e instanceof Error ? e.message : String(e)}`);
    });
    toast.success('Settings saved');
  };

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2>Sleep and calendar</h2>
      <div className="row">
        <label className="field">
          Sleep start
          <select value={sleepStart} onChange={(e) => setSleepStart(e.target.value)}>
            {TIME_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sleep end
          <select value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)}>
            {TIME_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Changes apply to days you haven&apos;t logged yet. To change one day, tap Sleep on the Day
        view.
      </p>

      <SegmentedControl
        legend="Week starts on"
        name="weekStart"
        value={weekStart}
        options={WEEK_OPTIONS}
        onChange={setWeekStart}
      />

      <button type="submit" className="btn btn-primary btn-block">
        Save
      </button>
    </form>
  );
}

function AccountSection() {
  const { user, signOut } = useAuth();
  return (
    <section className="card">
      <h2>Account</h2>
      <p>{user?.email ?? user?.displayName ?? user?.uid}</p>
      <button type="button" className="btn" onClick={() => void signOut()}>
        Sign out
      </button>
    </section>
  );
}
