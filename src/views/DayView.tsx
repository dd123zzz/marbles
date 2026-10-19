import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { PlusIcon } from '../components/icons.tsx';
import Jar from '../components/Jar.tsx';
import MarbleTray from '../components/MarbleTray.tsx';
import type { PhysicsJarHandle } from '../components/PhysicsJar.tsx';
import SummaryChips from '../components/SummaryChips.tsx';
import { useToast } from '../components/Toast.tsx';
import {
  FLY_MS,
  prefersReducedMotion,
  type DropInfo,
  type DropResult,
} from '../components/useMarbleDrag.ts';
import { useDays, useRepo, useSettings } from '../data/RepoProvider.tsx';
import { useDeviceTilt } from '../hooks/useDeviceTilt';
import { useJarStyle } from '../hooks/useJarStyle';
import { useNow } from '../hooks/useNow';
import { fullDate, weekdayMonthDay } from '../lib/dateLabels';
import {
  logicalEntriesForDay,
  logicalEntryAt,
  planDrop,
  undoDrop,
  type DropUndo,
} from '../lib/entries';
import { CATEGORY_LABEL, computeMarbles } from '../lib/jar';
import {
  addDays,
  isFutureSlot,
  isValidDateKey,
  lastHourWindow,
  parseDateKey,
  slotToHHmm,
  toDateKey,
} from '../lib/time';
import {
  SLOTS_PER_DAY,
  type Category,
  type DateKey,
  type DayDoc,
  type Marble,
  type SlotRef,
} from '../types';
import ShareButton from '../share/ShareButton.tsx';
import LogSheet, { type SheetMode } from './LogSheet.tsx';
import Reflection from './Reflection.tsx';
import SleepSheet from './SleepSheet.tsx';
import { defaultStartFor, formatEntryRange } from './logSheetLogic';
import { JarStyleToggle, TiltToggle } from './JarStyleToggle.tsx';
import { useWriteGate, writeErrorMessage } from './useWriteGate';
import './day.css';

const DROP_TOAST_KEY = 'drop';

// The physics code stays out of the main bundle until someone picks the Loose jar.
const PhysicsJar = lazy(() => import('../components/PhysicsJar.tsx'));

const follows = (a: SlotRef, b: SlotRef): boolean =>
  b.date === a.date
    ? b.slot === a.slot + 1
    : a.slot === SLOTS_PER_DAY - 1 && b.slot === 0 && b.date === addDays(a.date, 1);

/** "13:30–14:30", "23:30–00:30", or "yesterday 23:00–24:00" when no slot falls on today. */
function windowLabel(window: SlotRef[], today: DateKey): string {
  const runs: SlotRef[][] = [];
  for (const ref of window) {
    const run = runs[runs.length - 1];
    if (run && follows(run[run.length - 1], ref)) run.push(ref);
    else runs.push([ref]);
  }
  const text = runs
    .map((r) => `${slotToHHmm(r[0].slot)}–${slotToHHmm(r[r.length - 1].slot + 1)}`)
    .join(', ');
  return window.every((r) => r.date < today) ? `yesterday ${text}` : text;
}

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
  const repo = useRepo();
  const toast = useToast();
  const { writable } = useWriteGate({ loading, fromCache, settingsLoading });
  const jarRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLAnchorElement>(null);
  const physicsRef = useRef<PhysicsJarHandle>(null);
  const [jarStyle, setJarStyle] = useJarStyle();
  const loose = jarStyle === 'loose';
  const reducedMotion = prefersReducedMotion();
  const tilt = useDeviceTilt(loose && !reducedMotion);
  const view = useRef<{ date: DateKey; days: Record<DateKey, DayDoc> } | null>(null);
  const [armed, setArmed] = useState<Category | null>(null);
  const [dropDelay, setDropDelay] = useState(0);

  useEffect(() => {
    view.current = { date, days };
  });
  useEffect(
    () => () => {
      view.current = null;
    },
    [],
  );
  useEffect(() => {
    if (dropDelay === 0) return;
    const t = setTimeout(() => setDropDelay(0), 2000);
    return () => clearTimeout(t);
  }, [dropDelay]);

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

  const showTray = !!uid && date === today && !loading;
  const trayLabel = windowLabel(lastHourWindow(now), today);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const onWriteError = (e: unknown) => toast.error(writeErrorMessage(e));

  // Undo works from the latest snapshot while this view still covers the dropped days,
  // and otherwise (the user navigated away) from a fresh read.
  const undo = async (info: DropUndo) => {
    if (!uid) return;
    try {
      const dates = info.slots.map((s) => s.date).sort();
      const first = dates[0];
      const last = dates[dates.length - 1];
      const v = view.current;
      const covered = v && first >= addDays(v.date, -1) && last <= addDays(v.date, 1);
      const current = covered ? v.days : await repo.getDays(uid, first, last);
      const changed = undoDrop(current, info);
      if (Object.keys(changed).length > 0) await repo.writeDays(uid, changed);
    } catch (e) {
      onWriteError(e);
    }
  };

  const handleDrop = (category: Category, info: DropInfo): DropResult => {
    if (!uid || !writable) return { accepted: false };
    const at = new Date();
    const targets = lastHourWindow(at);
    if (targets.some((t) => t.date < addDays(date, -1) || t.date > addDays(date, 1))) {
      return { accepted: false };
    }
    const label = windowLabel(targets, toDateKey(at));
    const name = CATEGORY_LABEL[category];
    const plan = planDrop({
      days,
      targets,
      category,
      sleep: { start: settings.sleepStart, end: settings.sleepEnd },
      tz,
      now: at,
    });
    if (plan.noop) {
      toast.show(`${label} is already ${name}`, { key: DROP_TOAST_KEY });
      return { accepted: false };
    }
    // The Loose jar spawns the body at the release point, so nothing flies there.
    const flies = !loose && info.source === 'pointer' && !prefersReducedMotion();
    setDropDelay(flies ? FLY_MS : 0);
    // not awaited: the local cache updates immediately and the write syncs when online
    repo.writeDays(uid, plan.changed).catch(onWriteError);
    toast.success(`Logged ${label} as ${name}`, {
      key: DROP_TOAST_KEY,
      action: { label: 'Undo', onAction: () => void undo(plan.undo) },
    });
    const yesterdayOnly = targets.every((t) => t.date < toDateKey(at));
    if (loose && !yesterdayOnly) {
      const hours = new Set(
        targets.filter((t) => t.date === date).map((t) => Math.floor(t.slot / 2)),
      );
      // a keyboard drop has no release point: a point outside the jar spawns the marble at the neck
      const keyboard = info.source === 'keyboard';
      const x = keyboard ? -Infinity : info.clientX;
      const y = keyboard ? -Infinity : info.clientY;
      for (const hour of hours) physicsRef.current?.dropAt(hour, x, y, info.vx, info.vy);
      return { accepted: true, flyTo: 'none' };
    }
    if (info.source === 'keyboard') return { accepted: true, flyTo: 'none' };
    return {
      accepted: true,
      flyTo: yesterdayOnly ? prevRef.current?.getBoundingClientRect() : undefined,
    };
  };

  const onSelect = (slot: number, m: Marble) => selectSlot(slot, slot % 2 === 0 ? m.left : m.right);
  const gridJar = (
    <Jar
      marbles={marbles}
      label={`Jar for ${weekdayMonthDay(date)}`}
      date={date}
      dropDelayMs={dropDelay}
      onSelect={onSelect}
    />
  );

  const emptyText = isFuture
    ? 'This day is still ahead, so there is nothing to log yet.'
    : date === today
      ? 'No marbles yet — tap Log time to add your first hour.'
      : 'Nothing logged for this day. Tap Log time to add an entry.';

  return (
    <div className="stack">
      <header className="card date-card">
        <div className="date-nav">
          <Link
            ref={prevRef}
            className="icon-btn"
            to={`/day/${addDays(date, -1)}`}
            aria-label="Previous day"
          >
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
          <div className="jar-tools">
            {loose && !reducedMotion && tilt.supported && (
              <TiltToggle
                tilt={tilt}
                onDenied={() => toast.error('Tilt needs motion access. Allow it and try again.')}
              />
            )}
            <JarStyleToggle style={jarStyle} onChange={setJarStyle} />
          </div>
          {showTray && (
            <MarbleTray
              rangeLabel={trayLabel}
              writable={writable}
              onDrop={handleDrop}
              onArmedChange={setArmed}
              getDropTargetRect={() => jarRef.current?.getBoundingClientRect() ?? null}
            />
          )}
          <div ref={jarRef} className={`jar-slot${armed ? ` jar-armed jar-armed-${armed}` : ''}`}>
            {loose ? (
              <Suspense fallback={gridJar}>
                <PhysicsJar
                  ref={physicsRef}
                  marbles={marbles}
                  label={`Jar for ${weekdayMonthDay(date)}`}
                  date={date}
                  gravity={tilt.gravity ?? undefined}
                  onSelect={onSelect}
                />
              </Suspense>
            ) : (
              gridJar
            )}
          </div>
          <SummaryChips
            marbles={marbles}
            dateLabel={weekdayMonthDay(date)}
            onEditSleep={uid ? () => setSleepOpen(true) : undefined}
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
