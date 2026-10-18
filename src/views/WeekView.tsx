import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import MiniJar from '../components/MiniJar.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { monthDay, weekdayShort } from '../lib/dateLabels';
import { computeMarbles } from '../lib/jar';
import { addDays, isValidDateKey, parseDateKey, toDateKey, weekRange } from '../lib/time';

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

  return (
    <div>
      <div className="datebar">
        <Link to={`/week/${addDays(date, -7)}`} aria-label="Previous week">
          ‹ Prev
        </Link>
        <h1>
          {monthDay(keys[0])} – {monthDay(keys[6])}, {parseDateKey(keys[6]).getFullYear()}
        </h1>
        <Link to={`/week/${addDays(date, 7)}`} aria-label="Next week">
          Next ›
        </Link>
      </div>
      <p className="muted links">
        <Link to={`/week/${today}`}>This week</Link>
        <Link to={`/month/${date.slice(0, 7)}`}>Month</Link>
      </p>
      {error && (
        <p role="alert" className="error">
          Could not load this week: {error.message}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul className="week-grid">
          {keys.map((k) => {
            const doc = days[k];
            const sleep = doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
            const marbles = computeMarbles({ date: k, slots: doc?.slots, sleep, now });
            return (
              <li key={k}>
                <Link to={`/day/${k}`} className={k === today ? 'today' : undefined}>
                  <MiniJar date={k} marbles={marbles} size={44} />
                  <span>
                    {weekdayShort(k)} {parseDateKey(k).getDate()}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
