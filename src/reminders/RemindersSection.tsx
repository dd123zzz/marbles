import { useState } from 'react';
import type { Settings } from '../types';
import { buildReminderIcs, downloadIcs } from './ics';
import { notificationsSupported } from './notify';
import { setHourlyPref, useHourlyPref } from './prefs';
import './reminders.css';

export default function RemindersSection({ settings }: { settings: Settings }) {
  const pref = useHourlyPref();
  const [message, setMessage] = useState<string | null>(null);
  const on = pref && notificationsSupported() && Notification.permission === 'granted';

  const toggle = (checked: boolean) => {
    setMessage(null);
    if (!checked) {
      setHourlyPref(false);
      return;
    }
    if (!notificationsSupported()) {
      setMessage(
        "This browser doesn't support notifications. On iPhone, use the calendar reminders below.",
      );
      return;
    }
    // requested directly from the click, as browsers require
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setHourlyPref(true);
      } else {
        setMessage(
          'Notifications are blocked. Allow them for this site in your browser settings, then try again.',
        );
      }
    });
  };

  const addToCalendar = () => {
    const ics = buildReminderIcs({
      sleep: { start: settings.sleepStart, end: settings.sleepEnd },
      appUrl: location.origin + import.meta.env.BASE_URL,
    });
    downloadIcs(ics);
  };

  return (
    <section className="card reminders-section">
      <h2>Reminders</h2>
      <label className="switch-row">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={(e) => toggle(e.target.checked)}
        />
        Hourly notification while app is open
      </label>
      <p className="muted">Works only while Marbles is open; phones may pause background tabs.</p>
      {message && (
        <p className="muted error" role="alert">
          {message}
        </p>
      )}
      <button type="button" className="btn btn-block" onClick={addToCalendar}>
        Add hourly reminders to calendar (.ics)
      </button>
      <p className="muted">
        Opens in Calendar on iPhone; works without installing. Reminders repeat daily at the top of
        each awake hour, using your saved sleep times.
      </p>
    </section>
  );
}
