import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LABEL, MARBLE_COLORS } from '../lib/jar';
import { deleteEntry } from '../lib/entries';
import { isValidDateKey, toDateKey } from '../lib/time';
import { useDays, useRepo } from '../data/RepoProvider.tsx';
import type { Category, DateKey, DayDoc, Entry, Settings } from '../types';
import {
  buildEntry,
  createForm,
  describeRange,
  durationOptions,
  editForm,
  planSave,
  startOptions,
  touchedRange,
  type FormState,
} from './logSheetLogic';

export type SheetMode =
  { kind: 'create'; date: DateKey; startSlot: number } | { kind: 'edit'; entry: Entry };

interface LogSheetProps {
  uid: string;
  mode: SheetMode;
  now: Date;
  settings: Settings;
  settingsLoading: boolean;
  onClose: () => void;
}

const CATEGORIES: Category[] = ['g', 'b', 'r'];
const START_OPTIONS = startOptions();
const DURATION_OPTIONS = durationOptions();
/** After this long with only cached data we assume we are offline and let the user log. */
const CACHE_GRACE_MS = 4000;

function useOffline(): boolean {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}

function reportWriteError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  window.alert(`Could not save your changes: ${msg}`);
}

export default function LogSheet({
  uid,
  mode,
  now,
  settings,
  settingsLoading,
  onClose,
}: LogSheetProps) {
  const repo = useRepo();
  const original = mode.kind === 'edit' ? mode.entry : undefined;
  const anchor = mode.kind === 'edit' ? mode.entry.date : mode.date;
  const [form, setForm] = useState<FormState>(() =>
    mode.kind === 'edit' ? editForm(mode.entry) : createForm(mode, now),
  );
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const offline = useOffline();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    firstRef.current?.focus();
    const t = setTimeout(() => setGraceElapsed(true), CACHE_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  // Day docs the entry can touch: the original's day pair, plus the form date's pair when it differs.
  const base = touchedRange(anchor);
  const sameDate = form.date === anchor;
  const form2 = touchedRange(isValidDateKey(form.date) ? form.date : anchor);
  const a = useDays(uid, base.start, base.end);
  const b = useDays(sameDate ? undefined : uid, form2.start, form2.end);
  const loading = a.loading || (!sameDate && b.loading);
  const loadError = a.error ?? (sameDate ? null : b.error);
  const fromCache = a.fromCache || (!sameDate && b.fromCache);
  const days: Record<DateKey, DayDoc> = { ...a.days, ...(sameDate ? {} : b.days) };
  // A partial cache can lack docs that exist on the server; writing from it could wipe them.
  const daysReady = !loading && (!fromCache || offline || graceElapsed);

  const patch = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }));
    setError(null);
  };

  const sleep = { start: settings.sleepStart, end: settings.sleepEnd };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = toDateKey(now);
  const range = describeRange(form.startSlot, form.length);

  const save = (category: Category) => {
    const plan = planSave({
      days,
      entry: buildEntry(form, category),
      original,
      now: new Date(),
      sleep,
      tz,
    });
    if (!plan.ok) {
      setError(plan.error);
      return;
    }
    if (
      plan.conflicts > 0 &&
      !window.confirm(`This overwrites ${plan.conflicts} logged half-hours. Continue?`)
    ) {
      return;
    }
    onClose();
    // not awaited: the local cache updates immediately and the write syncs when online
    if (Object.keys(plan.changed).length > 0) {
      repo.writeDays(uid, plan.changed).catch(reportWriteError);
    }
  };

  const remove = () => {
    if (!original || !window.confirm('Delete this entry?')) return;
    const changed = deleteEntry(days, original);
    onClose();
    if (Object.keys(changed).length > 0) repo.writeDays(uid, changed).catch(reportWriteError);
  };

  const blocked = !daysReady || settingsLoading || loadError !== null;
  const syncing = loadError === null && (!daysReady || settingsLoading);
  const isEdit = mode.kind === 'edit';

  return (
    <div className="overlay">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-sheet-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="sheet-head">
          <h2 id="log-sheet-title">{isEdit ? 'Edit entry' : 'Log time'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className="field">
          Date
          <input
            ref={firstRef}
            type="date"
            value={form.date}
            max={today}
            onChange={(e) => isValidDateKey(e.target.value) && patch({ date: e.target.value })}
          />
        </label>
        <div className="row">
          <label className="field">
            Start
            <select
              value={form.startSlot}
              onChange={(e) => patch({ startSlot: Number(e.target.value) })}
            >
              {START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Duration (h:mm)
            <select value={form.length} onChange={(e) => patch({ length: Number(e.target.value) })}>
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" aria-live="polite">
          {range.text}
          {range.crossesMidnight && ' (continues to next day)'}
        </p>
        <label className="field">
          Note (optional)
          <input
            type="text"
            maxLength={200}
            value={form.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loadError && (
          <p role="alert" className="error">
            Could not load this day: {loadError.message}
          </p>
        )}

        {syncing && (
          <p className="muted" role="status">
            Syncing…
          </p>
        )}
        {!isEdit && <p className="muted">Tap a category to save</p>}
        <div className="categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`category${form.category === c ? ' selected' : ''}`}
              style={{ background: MARBLE_COLORS[c] }}
              aria-pressed={isEdit ? form.category === c : undefined}
              disabled={blocked}
              onClick={() => (isEdit ? patch({ category: c }) : save(c))}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {isEdit && (
          <div className="row actions">
            <button
              type="button"
              className="primary"
              disabled={blocked || form.category === null}
              onClick={() => form.category && save(form.category)}
            >
              Save
            </button>
            <button type="button" disabled={blocked} onClick={remove}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
