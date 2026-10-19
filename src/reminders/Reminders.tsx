import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { toDateKey } from '../lib/time';
import { notificationsSupported } from './notify';
import { useHourlyPref } from './prefs';
import { formatUnlogged, unloggedHours } from './unlogged';
import { useHourlyNotification } from './useHourlyNotification';
import './reminders.css';

/**
 * Mounted once in Layout. Subscribes to today's doc only while something needs
 * it: the banner (on today's Day screen) or the opt-in hourly notification.
 */
export default function Reminders({ showBanner }: { showBanner: boolean }) {
  const { user } = useAuth();
  const now = useNow();
  const today = toDateKey(now);
  const pref = useHourlyPref();
  const notify = pref && notificationsSupported() && Notification.permission === 'granted';
  const uid = showBanner || notify ? user?.uid : undefined;

  const { settings, loading: settingsLoading } = useSettings(uid);
  const { days, loading: daysLoading } = useDays(uid, today, today);
  const doc = days[today];
  const ready = !!uid && !settingsLoading && !daysLoading;

  useHourlyNotification(user?.uid, notify, { date: today, doc, settings, ready });

  const [dismissed, setDismissed] = useState<{ key: string; hours: number } | null>(null);

  if (!showBanner || !ready) return null;
  const hours = unloggedHours(today, doc, settings, now);
  // dismissal holds until the count changes or the hour rolls over
  const key = `${today}T${now.getHours()}`;
  if (hours === 0 || (dismissed?.key === key && dismissed.hours === hours)) return null;

  return (
    <div className="reminder-banner" role="status">
      <span>{formatUnlogged(hours)} today</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss reminder"
        onClick={() => setDismissed({ key, hours })}
      >
        ×
      </button>
    </div>
  );
}
