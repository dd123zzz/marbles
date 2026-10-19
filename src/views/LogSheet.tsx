import { useEffect, useRef, useState } from 'react';
import BottomSheet from '../components/BottomSheet.tsx';
import { useToast } from '../components/Toast.tsx';
import { CATEGORY_LABEL } from '../lib/jar';
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
import { useWriteGate, writeErrorMessage } from './useWriteGate';

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

export default function LogSheet({
  uid,
  mode,
  now,
  settings,
  settingsLoading,
  onClose,
}: LogSheetProps) {
  const repo = useRepo();
  const toast = useToast();
  const original = mode.kind === 'edit' ? mode.entry : undefined;
  const anchor = mode.kind === 'edit' ? mode.entry.date : mode.date;
  const [form, setForm] = useState<FormState>(() =>
    mode.kind === 'edit' ? editForm(mode.entry) : createForm(mode, now),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: 'overwrite'; category: Category; conflicts: number } | { kind: 'delete' } | null
  >(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirm) cancelRef.current?.focus();
  }, [confirm]);

  // Day docs the entry can touch: the original's day pair (it may start the day before the
  // view's date), plus the form date's pair when it differs.
  const base = touchedRange(anchor);
  const sameDate = form.date === anchor;
  const form2 = touchedRange(isValidDateKey(form.date) ? form.date : anchor);
  const a = useDays(uid, base.start, base.end);
  const b = useDays(sameDate ? undefined : uid, form2.start, form2.end);
  const loading = a.loading || (!sameDate && b.loading);
  const loadError = a.error ?? (sameDate ? null : b.error);
  const fromCache = a.fromCache || (!sameDate && b.fromCache);
  const days: Record<DateKey, DayDoc> = { ...a.days, ...(sameDate ? {} : b.days) };
  const { daysReady } = useWriteGate({ loading, fromCache, settingsLoading });

  const patch = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }));
    setError(null);
  };

  const sleep = { start: settings.sleepStart, end: settings.sleepEnd };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = toDateKey(now);
  const range = describeRange(form.startSlot, form.length);

  const onWriteError = (e: unknown) => toast.error(writeErrorMessage(e));

  const save = (category: Category, confirmed = false) => {
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
    if (plan.conflicts > 0 && !confirmed) {
      setConfirm({ kind: 'overwrite', category, conflicts: plan.conflicts });
      return;
    }
    onClose();
    // not awaited: the local cache updates immediately and the write syncs when online
    if (Object.keys(plan.changed).length > 0) {
      repo.writeDays(uid, plan.changed).catch(onWriteError);
    }
  };

  const remove = () => {
    if (!original) return;
    const changed = deleteEntry(days, original);
    onClose();
    if (Object.keys(changed).length > 0) repo.writeDays(uid, changed).catch(onWriteError);
  };

  const blocked = !daysReady || settingsLoading || loadError !== null;
  const syncing = loadError === null && (!daysReady || settingsLoading);
  const isEdit = mode.kind === 'edit';

  const header = (
    <div className="sheet-head">
      <h2 id="log-sheet-title">{isEdit ? 'Edit entry' : 'Log time'}</h2>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );

  if (confirm) {
    const isDelete = confirm.kind === 'delete';
    return (
      <BottomSheet titleId="log-sheet-title" onClose={onClose}>
        {header}
        <div className="sheet-body">
          <div className="confirm" role="group" aria-labelledby="confirm-text">
            <p id="confirm-text">
              {isDelete
                ? 'Delete this entry?'
                : `This overwrites ${confirm.conflicts} logged half-hour${confirm.conflicts === 1 ? '' : 's'}.`}
            </p>
          </div>
        </div>
        <div className="sheet-foot">
          <div className="sheet-actions">
            <button
              ref={cancelRef}
              type="button"
              className="btn"
              onClick={(e) => {
                // the form comes back, so keep focus inside the dialog
                e.currentTarget.closest<HTMLElement>('.sheet')?.focus();
                setConfirm(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${isDelete ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => (isDelete ? remove() : save(confirm.category, true))}
            >
              {isDelete ? 'Delete entry' : 'Overwrite'}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet titleId="log-sheet-title" onClose={onClose}>
      {header}
      <div className="sheet-body">
        <label className="field">
          Date
          <input
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
      </div>

      <div className="sheet-foot">
        {!isEdit && <p className="muted">Tap a category to save</p>}
        <div className="categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`category category-${c}${form.category === c ? ' selected' : ''}`}
              aria-pressed={isEdit ? form.category === c : undefined}
              disabled={blocked}
              onClick={() => (isEdit ? patch({ category: c }) : save(c))}
            >
              <span className={`dot dot-${c}`} aria-hidden="true" />
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {isEdit && (
          <div className="sheet-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={blocked || form.category === null}
              onClick={() => form.category && save(form.category)}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={blocked}
              onClick={() => setConfirm({ kind: 'delete' })}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
