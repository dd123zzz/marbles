import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import MiniJar from '../components/MiniJar.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import {
  WEEKDAYS_MON_FIRST,
  WEEKDAYS_SUN_FIRST,
  monthTitle,
  parseYearMonth,
  shiftMonth,
} from '../lib/dateLabels';
import { computeMarbles } from '../lib/jar';
import { monthGrid, monthRange, parseDateKey, toDateKey } from '../lib/time';

export default function MonthView() {
  const { ym } = useParams();
  const parsed = ym === undefined ? null : parseYearMonth(ym);
  if (!parsed) return <Navigate to="/" replace />;
  return <Month year={parsed.year} month0={parsed.month0} />;
}

function Month({ year, month0 }: { year: number; month0: number }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const now = useNow();
  const { settings } = useSettings(uid);
  const range = monthRange(year, month0);
  const { days, loading, error } = useDays(uid, range.start, range.end);
  const grid = monthGrid(year, month0, settings.weekStart);
  const headers = settings.weekStart === 'mon' ? WEEKDAYS_MON_FIRST : WEEKDAYS_SUN_FIRST;
  const today = toDateKey(now);

  return (
    <div>
      <div className="datebar">
        <Link to={`/month/${shiftMonth(year, month0, -1)}`} aria-label="Previous month">
          ‹ Prev
        </Link>
        <h1>{monthTitle(year, month0)}</h1>
        <Link to={`/month/${shiftMonth(year, month0, 1)}`} aria-label="Next month">
          Next ›
        </Link>
      </div>
      <p className="muted links">
        <Link to={`/month/${today.slice(0, 7)}`}>This month</Link>
        <Link to={`/week/${range.start}`}>Week</Link>
      </p>
      {error && (
        <p role="alert" className="error">
          Could not load this month: {error.message}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="month-grid">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, i) => (
              <tr key={i}>
                {row.map((k, j) => {
                  if (!k) return <td key={j} />;
                  const doc = days[k];
                  const sleep = doc?.sleep ?? {
                    start: settings.sleepStart,
                    end: settings.sleepEnd,
                  };
                  const marbles = computeMarbles({ date: k, slots: doc?.slots, sleep, now });
                  return (
                    <td key={j}>
                      <Link to={`/day/${k}`} className={k === today ? 'today' : undefined}>
                        <MiniJar date={k} marbles={marbles} size={36} />
                        <span>{parseDateKey(k).getDate()}</span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
