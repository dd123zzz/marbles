import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { PlusIcon } from '../components/icons.tsx';
import Jar from '../components/Jar.tsx';
import SummaryChips from '../components/SummaryChips.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { fullDate, weekdayMonthDay } from '../lib/dateLabels';
import { logicalEntriesForDay, logicalEntryAt } from '../lib/entries';
import { CATEGORY_LABEL, computeMarbles } from '../lib/jar';
import { addDays, isFutureSlot, isValidDateKey, parseDateKey, toDateKey } from '../lib/time';
import ShareButton from '../share/ShareButton.tsx';
import LogSheet, { type SheetMode } from './LogSheet.tsx';
import Reflection from './Reflection.tsx';
import SleepSheet from './SleepSheet.tsx';
import { defaultStartFor, formatEntryRange } from './logSheetLogic';
import './day.css';

export default function DayView() {
  const { date: param } = useParams();
  if (param !== undefined && !isValidDateKey(param)) return <Navigate to="/" replace />;
  return <Day param={param} />;
}

function Day({ param }: { param: string | undefined }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const navigate = useNavigate();
  const now = useNow();
  const today = toDateKey(now);
  const date = param ?? today;
  const { settings, loading: settingsLoading } = useSettings(uid);
  // Neighbouring days let an entry that crosses midnight resolve as one.
  const { days, loading, fromCache, error } = useDays(uid, addDays(date, -1), addDays(date, 1));
  const [sheet, setSheet] = useState<{ mode: SheetMode; id: number } | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);

  const doc = days[date];
  const sleep = doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
  const marbles = computeMarbles({ date, slots: doc?.slots, sleep, now });
  const entries = logicalEntriesForDay(days, date);
  const isFuture = date > today;

  const open = (mode: SheetMode) => setSheet((s) => ({ mode, id: (s?.id ?? 0) + 1 }));

  const logTime = () => open({ kind: 'create', ...defaultStartFor(date, now) });

  const selectSlot = (slot: number, color: string) => {
    const entry = logicalEntryAt(days, date, slot);
    if (entry) open({ kind: 'edit', entry });
    else if (color !== 'na' && !isFutureSlot(date, slot, now)) {
      open({ kind: 'create', date, startSlot: slot });
    }
  };

  const emptyText = isFuture
    ? 'This day is still ahead, so there is nothing to log yet.'
    : date === today
      ? 'No marbles yet — tap Log time to add your first hour.'
      : 'Nothing logged for this day. Tap Log time to add an entry.';

  return (
    <div className="stack">
      <header className="card date-card">
        <div className="date-nav">
          <Link className="icon-btn" to={`/day/${addDays(date, -1)}`} aria-label="Previous day">
            ‹
          </Link>
          <div className="date-title">
            <h1>{weekdayMonthDay(date)}</h1>
            <p className="muted">{date === today ? 'Today' : parseDateKey(date).getFullYear()}</p>
          </div>
          {date >= today ? (
            <span className="icon-btn" aria-disabled="true">
              ›
            </span>
          ) : (
            <Link className="icon-btn" to={`/day/${addDays(date, 1)}`} aria-label="Next day">
              ›
            </Link>
          )}
        </div>
        <div className="date-tools">
          <input
            type="date"
            className="text-input"
            aria-label="Pick a date"
            value={date}
            max={today}
            onChange={(e) => isValidDateKey(e.target.value) && navigate(`/day/${e.target.value}`)}
          />
          {date !== today && (
            <Link className="btn" to="/">
              Today
            </Link>
          )}
          <ShareButton
            spec={{ kind: 'day', date, marbles }}
            label="Share day image"
            title={`Marbles — ${fullDate(date)}`}
            filename={`marbles-${date}`}
          />
        </div>
      </header>

      {error && (
        <p role="alert" className="error">
          Could not load this day: {error.message}
        </p>
      )}
      {loading ? (
        <p className="loading">Loading…</p>
      ) : (
        <section className="card jar-card" aria-label="Jar">
          <SummaryChips
            marbles={marbles}
            dateLabel={weekdayMonthDay(date)}
            onEditSleep={uid ? () => setSleepOpen(true) : undefined}
          />
          <Jar
            marbles={marbles}
            label={`Jar for ${weekdayMonthDay(date)}`}
            date={date}
            onSelect={(slot, m) => selectSlot(slot, slot % 2 === 0 ? m.left : m.right)}
          />
        </section>
      )}

      <button
        type="button"
        className="btn btn-primary log-btn"
        disabled={isFuture || !uid || settingsLoading}
        onClick={logTime}
      >
        <PlusIcon />
        Log time
      </button>

      <section className="card">
        <h2>Entries</h2>
        {entries.length === 0 ? (
          !loading && <p className="muted empty">{emptyText}</p>
        ) : (
          <ul className="entries">
            {entries.map((e) => (
              <li key={`${e.date}#${e.startSlot}`}>
                <button
                  type="button"
                  className="entry"
                  onClick={() => open({ kind: 'edit', entry: e })}
                >
                  <span className={`dot dot-${e.category}`} aria-hidden="true" />
                  <span className="entry-text">
                    {formatEntryRange(e, date)} · {CATEGORY_LABEL[e.category]}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                  <span className="entry-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isFuture && uid && (
        <Reflection
          key={date}
          uid={uid}
          date={date}
          doc={doc}
          loading={loading}
          fromCache={fromCache}
          settings={settings}
          settingsLoading={settingsLoading}
        />
      )}

      {sleepOpen && uid && (
        <SleepSheet
          uid={uid}
          date={date}
          doc={doc}
          current={sleep}
          fallback={{ start: settings.sleepStart, end: settings.sleepEnd }}
          loading={loading}
          fromCache={fromCache}
          settingsLoading={settingsLoading}
          onClose={() => setSleepOpen(false)}
        />
      )}

      {sheet && uid && (
        <LogSheet
          key={sheet.id}
          uid={uid}
          mode={sheet.mode}
          now={now}
          settings={settings}
          settingsLoading={settingsLoading}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
