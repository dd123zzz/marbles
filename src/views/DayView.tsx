import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import Jar from '../components/Jar.tsx';
import { useDays, useSettings } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { weekdayMonthDay } from '../lib/dateLabels';
import { entriesFromDay, entryAt } from '../lib/entries';
import { CATEGORY_LABEL, computeMarbles, formatSummary, summarize } from '../lib/jar';
import { addDays, formatSlotRange, isFutureSlot, isValidDateKey, toDateKey } from '../lib/time';
import LogSheet, { type SheetMode } from './LogSheet.tsx';
import { defaultStartFor } from './logSheetLogic';

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
  const { days, loading, error } = useDays(uid, date, date);
  const [sheet, setSheet] = useState<{ mode: SheetMode; id: number } | null>(null);

  const doc = days[date];
  const sleep = doc?.sleep ?? { start: settings.sleepStart, end: settings.sleepEnd };
  const marbles = computeMarbles({ date, slots: doc?.slots, sleep, now });
  const entries = entriesFromDay(date, doc);
  const isFuture = date > today;

  const open = (mode: SheetMode) => setSheet((s) => ({ mode, id: (s?.id ?? 0) + 1 }));

  const logTime = () => open({ kind: 'create', ...defaultStartFor(date, now) });

  const selectSlot = (slot: number, color: string) => {
    const entry = entryAt(date, doc, slot);
    if (entry) open({ kind: 'edit', entry });
    else if (color !== 'na' && !isFutureSlot(date, slot, now)) {
      open({ kind: 'create', date, startSlot: slot });
    }
  };

  return (
    <div>
      <div className="datebar">
        <Link to={`/day/${addDays(date, -1)}`} aria-label="Previous day">
          ‹ Prev
        </Link>
        <input
          type="date"
          aria-label="Pick a date"
          value={date}
          max={today}
          onChange={(e) => isValidDateKey(e.target.value) && navigate(`/day/${e.target.value}`)}
        />
        {date >= today ? (
          <span className="disabled" aria-disabled="true">
            Next ›
          </span>
        ) : (
          <Link to={`/day/${addDays(date, 1)}`} aria-label="Next day">
            Next ›
          </Link>
        )}
      </div>
      <h1>{weekdayMonthDay(date)}</h1>
      <p className="muted links">
        {date !== today && <Link to="/">Today</Link>}
        <Link to={`/week/${date}`}>Week</Link>
        <Link to={`/month/${date.slice(0, 7)}`}>Month</Link>
      </p>

      {error && (
        <p role="alert" className="error">
          Could not load this day: {error.message}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <Jar
            marbles={marbles}
            label={`Jar for ${weekdayMonthDay(date)}`}
            onSelect={(slot, m) => selectSlot(slot, slot % 2 === 0 ? m.left : m.right)}
          />
          <p className="summary">{formatSummary(summarize(marbles))}</p>
        </>
      )}

      <button
        type="button"
        className="primary big"
        disabled={isFuture || !uid || settingsLoading}
        onClick={logTime}
      >
        Log time
      </button>

      <h2>Entries</h2>
      {entries.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul className="entries">
          {entries.map((e) => (
            <li key={e.startSlot}>
              <button type="button" onClick={() => open({ kind: 'edit', entry: e })}>
                {formatSlotRange(e.startSlot, e.length)} · {CATEGORY_LABEL[e.category]}
                {e.note ? ` · ${e.note}` : ''}
              </button>
            </li>
          ))}
        </ul>
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
