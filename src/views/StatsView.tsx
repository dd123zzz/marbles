import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { fullDate, monthDay, monthTitle } from '../lib/dateLabels';
import { CATEGORY_LABEL, MARBLE_COLORS } from '../lib/jar';
import { computeStats, roundPct } from '../lib/stats';
import { addDays, isValidDateKey, monthRange, parseDateKey, weekRange } from '../lib/time';
import type { DateKey, MarbleColor, WeekStart } from '../types';

type Period = 'day' | 'week' | 'month';
type Basis = 'awake' | 'day';

const PERIODS: Period[] = ['day', 'week', 'month'];
const PERIOD_LABEL: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month' };

type RowKey = 'g' | 'b' | 'r' | 'sleep' | 'unlogged' | 'notYet';
const ROWS: Record<Basis, RowKey[]> = {
  awake: ['g', 'b', 'r', 'unlogged'],
  day: ['g', 'b', 'r', 'sleep', 'unlogged', 'notYet'],
};
const ROW_COLOR: Record<RowKey, MarbleColor> = {
  g: 'g',
  b: 'b',
  r: 'r',
  sleep: 'sleep',
  unlogged: 'unlogged',
  notYet: 'empty',
};

function isPeriod(p: string | undefined): p is Period {
  return p === 'day' || p === 'week' || p === 'month';
}

function rangeFor(period: Period, date: DateKey, weekStart: WeekStart): DateKey[] {
  if (period === 'day') return [date];
  if (period === 'week') return weekRange(date, weekStart);
  const d = parseDateKey(date);
  const { start, end } = monthRange(d.getFullYear(), d.getMonth());
  const keys: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) keys.push(k);
  return keys;
}

function shiftAnchor(period: Period, date: DateKey, dir: 1 | -1): DateKey {
  if (period === 'day') return addDays(date, dir);
  if (period === 'week') return addDays(date, 7 * dir);
  const d = parseDateKey(date);
  const first = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  return `${String(first.getFullYear()).padStart(4, '0')}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
}

function title(period: Period, keys: DateKey[]): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (period === 'day') return fullDate(first);
  if (period === 'month') {
    const d = parseDateKey(first);
    return monthTitle(d.getFullYear(), d.getMonth());
  }
  return `${monthDay(first)} – ${monthDay(last)}, ${parseDateKey(last).getFullYear()}`;
}

const fmtHours = (h: number): string => `${Number.isInteger(h) ? h : h.toFixed(1)}h`;

export default function StatsView() {
  const { period, date } = useParams();
  if (!isPeriod(period) || date === undefined || !isValidDateKey(date)) {
    return <Navigate to="/" replace />;
  }
  return <Stats period={period} date={date} />;
}

function Stats({ period, date }: { period: Period; date: DateKey }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const now = useNow();
  const { settings } = useSettings(uid);
  const [basis, setBasis] = useState<Basis>('awake');
  const keys = rangeFor(period, date, settings.weekStart);
  const { days, loading, error } = useDays(uid, keys[0], keys[keys.length - 1]);

  const stats = computeStats({
    dates: keys,
    days,
    settingsSleep: { start: settings.sleepStart, end: settings.sleepEnd },
    now,
  });
  const pctOf = (k: RowKey): number =>
    basis === 'awake'
      ? stats.awakePct[k as keyof typeof stats.awakePct]
      : stats.dayPct[k as keyof typeof stats.dayPct];
  const label = (k: RowKey): string => (k === 'notYet' ? 'Not yet' : CATEGORY_LABEL[ROW_COLOR[k]]);

  return (
    <div className="stats">
      <nav className="tabs" aria-label="Stats period">
        {PERIODS.map((p) => (
          <Link
            key={p}
            to={`/stats/${p}/${date}`}
            aria-current={p === period ? 'page' : undefined}
            className={p === period ? 'active' : ''}
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>
      <div className="datebar">
        <Link
          to={`/stats/${period}/${shiftAnchor(period, date, -1)}`}
          aria-label={`Previous ${period}`}
        >
          ‹ Prev
        </Link>
        <h1>{title(period, keys)}</h1>
        <Link to={`/stats/${period}/${shiftAnchor(period, date, 1)}`} aria-label={`Next ${period}`}>
          Next ›
        </Link>
      </div>

      <fieldset className="basis-toggle">
        <legend>Percentages</legend>
        <label className="inline">
          <input
            type="radio"
            name="basis"
            checked={basis === 'awake'}
            onChange={() => setBasis('awake')}
          />
          Of awake time
        </label>
        <label className="inline">
          <input
            type="radio"
            name="basis"
            checked={basis === 'day'}
            onChange={() => setBasis('day')}
          />
          Of 24 hours
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="error">
          Could not load stats: {error.message}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Hours</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {ROWS[basis].map((k) => (
                <tr key={k} className={`stats-row stats-${k}`}>
                  <th scope="row">{label(k)}</th>
                  <td>{fmtHours(stats.hours[k])}</td>
                  <td>{roundPct(pctOf(k)).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="stats-bars">
            {ROWS[basis].map((k) => {
              const p = roundPct(pctOf(k));
              return (
                <li key={k} className="stats-bar-row">
                  <span className="stats-bar-label">
                    {label(k)} {p.toFixed(1)}%
                  </span>
                  <span className="stats-bar-track" aria-hidden="true">
                    <span
                      className="stats-bar"
                      style={{
                        display: 'block',
                        height: '0.75rem',
                        width: `${pctOf(k)}%`,
                        background: MARBLE_COLORS[ROW_COLOR[k]],
                        border: k === 'notYet' ? '1px dashed #9ca3af' : undefined,
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          {stats.hours.na > 0 && (
            <p className="muted">
              {fmtHours(stats.hours.na)} skipped by daylight saving time is not counted.
            </p>
          )}
          {basis === 'awake' && <p className="muted">Sleep time is excluded.</p>}
        </>
      )}
    </div>
  );
}
