import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import WeekTimeline, { WeekTimelineSkeleton } from '../components/WeekTimeline.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { monthDay } from '../lib/dateLabels';
import { computeMarbles, isEmptyPastDay } from '../lib/jar';
import { weekTimeline } from '../lib/jar/timeline';
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
  const keys = useMemo(() => weekRange(date, settings.weekStart), [date, settings.weekStart]);
  const { days, loading, error } = useDays(uid, keys[0], keys[6]);
  const today = toDateKey(now);
  const weekDays = keys.map((k) => {
    const doc = days[k];
    const sleep = doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
    return {
      date: k,
      marbles: computeMarbles({ date: k, slots: doc?.slots, sleep, now }),
      nothingLogged: isEmptyPastDay(k, today, doc?.slots),
    };
  });

  const { sleepStart, sleepEnd } = settings;
  const tl = useMemo(
    () =>
      weekTimeline({
        dates: keys,
        days,
        settingsSleep: { start: sleepStart, end: sleepEnd },
        now,
      }),
    [keys, days, sleepStart, sleepEnd, now],
  );

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
        <WeekTimelineSkeleton />
      ) : (
        <WeekTimeline
          days={tl.days}
          total={tl.total}
          statsHref={`/stats/week/${keys[0]}`}
          showNow={keys.includes(today)}
          nowLabel={`Now ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}
        />
      )}
    </div>
  );
}
