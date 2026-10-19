import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { fullDate, monthDay, monthTitle } from '../lib/dateLabels';
import SegmentedControl from '../components/SegmentedControl.tsx';
import { CATEGORY_LABEL } from '../lib/jar';
import { computeStats, roundPct } from '../lib/stats';
import { addDays, isValidDateKey, monthRange, parseDateKey, weekRange } from '../lib/time';
import type { DateKey, MarbleColor, WeekStart } from '../types';
import './stats.css';

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

  const hasData = stats.hours.g + stats.hours.b + stats.hours.r > 0;

  return (
    <div className="stack">
      <nav className="segmented" aria-label="Stats period">
        {PERIODS.map((p) => (
          <Link
            key={p}
            to={`/stats/${p}/${date}`}
            aria-current={p === period ? 'page' : undefined}
            className="segment"
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>
      <header className="card date-card">
        <div className="date-nav">
          <Link
            className="icon-btn"
            to={`/stats/${period}/${shiftAnchor(period, date, -1)}`}
            aria-label={`Previous ${period}`}
          >
            ‹
          </Link>
          <div className="date-title">
            <h1>{title(period, keys)}</h1>
          </div>
          <Link
            className="icon-btn"
            to={`/stats/${period}/${shiftAnchor(period, date, 1)}`}
            aria-label={`Next ${period}`}
          >
            ›
          </Link>
        </div>
      </header>

      <SegmentedControl
        legend="Percentages"
        name="basis"
        value={basis}
        options={[
          { value: 'awake', label: 'Of awake time' },
          { value: 'day', label: 'Of 24 hours' },
        ]}
        onChange={setBasis}
      />

      {error && (
        <p role="alert" className="error">
          Could not load stats: {error.message}
        </p>
      )}
      {loading ? (
        <p className="loading">Loading…</p>
      ) : !hasData ? (
        <section className="card empty-card">
          <h2>No data yet</h2>
          <p className="muted">
            Nothing is logged for this {period}. Log some time on the Day tab and the totals will
            show up here.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Time by category</h2>
            <ul className="stats-bars">
              {ROWS[basis].map((k) => {
                const p = roundPct(pctOf(k));
                return (
                  <li key={k} className="stats-bar-row">
                    <span className="stats-bar-label">
                      <span className={`dot dot-${ROW_COLOR[k]}`} aria-hidden="true" />
                      {label(k)} {p.toFixed(1)}%
                    </span>
                    <span className="stats-bar-track" aria-hidden="true">
                      <span
                        className={`stats-bar stats-bar-${ROW_COLOR[k]}`}
                        style={{ width: `${pctOf(k)}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card">
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
            {stats.hours.na > 0 && (
              <p className="muted">
                {fmtHours(stats.hours.na)} skipped by daylight saving time is not counted.
              </p>
            )}
            {basis === 'awake' && <p className="muted">Sleep time is excluded.</p>}
          </section>
        </>
      )}
    </div>
  );
}
