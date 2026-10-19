import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import MiniJar from '../components/MiniJar.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { monthDay, weekdayShort } from '../lib/dateLabels';
import { computeMarbles } from '../lib/jar';
import { addDays, isValidDateKey, parseDateKey, toDateKey, weekRange } from '../lib/time';
import { weekTitle } from '../share/drawJar';
import ShareButton from '../share/ShareButton.tsx';
import './calendar.css';

export default function WeekView() {
  const { date } = useParams();
  if (date === undefined || !isValidDateKey(date)) return <Navigate to="/" replace />;
  return <Week date={date} />;
}

function Week({ date }: { date: string }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const now = useNow();
  const { settings } = useSettings(uid);
  const keys = weekRange(date, settings.weekStart);
  const { days, loading, error } = useDays(uid, keys[0], keys[6]);
  const today = toDateKey(now);
  const weekDays = keys.map((k) => {
    const doc = days[k];
    const sleep = doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
    return { date: k, marbles: computeMarbles({ date: k, slots: doc?.slots, sleep, now }) };
  });

  return (
    <div className="stack">
      <header className="card date-card">
        <div className="date-nav">
          <Link className="icon-btn" to={`/week/${addDays(date, -7)}`} aria-label="Previous week">
            ‹
          </Link>
          <div className="date-title">
            <h1>
              {monthDay(keys[0])} – {monthDay(keys[6])}
            </h1>
            <p className="muted">{parseDateKey(keys[6]).getFullYear()}</p>
          </div>
          <Link className="icon-btn" to={`/week/${addDays(date, 7)}`} aria-label="Next week">
            ›
          </Link>
        </div>
        <div className="date-tools">
          <Link className="btn" to={`/week/${today}`}>
            This week
          </Link>
          <Link className="btn" to={`/month/${date.slice(0, 7)}`}>
            Month
          </Link>
          {!loading && (
            <ShareButton
              spec={{ kind: 'week', title: weekTitle(keys[0]), days: weekDays }}
              label="Share week image"
              title={`Marbles — ${weekTitle(keys[0])}`}
              filename={`marbles-week-${keys[0]}`}
            />
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          Could not load this week: {error.message}
        </p>
      )}
      {loading ? (
        <p className="loading">Loading…</p>
      ) : (
        <ul className="week-grid">
          {weekDays.map(({ date: k, marbles }) => {
            const dow = parseDateKey(k).getDay();
            const cls = ['day-cell', k === today && 'today', (dow === 0 || dow === 6) && 'weekend']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={k}>
                <Link to={`/day/${k}`} className={cls}>
                  <MiniJar date={k} marbles={marbles} size={44} />
                  <span className="day-name">{weekdayShort(k)}</span>
                  <span>{parseDateKey(k).getDate()}</span>
                  {k === today && <span className="today-badge">Today</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
