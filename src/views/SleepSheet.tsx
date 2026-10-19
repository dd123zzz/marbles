import { useState } from 'react';
import BottomSheet from '../components/BottomSheet.tsx';
import { useToast } from '../components/Toast.tsx';
import { useRepo } from '../data/RepoProvider.tsx';
import { fullDate } from '../lib/dateLabels';
import type { DateKey, DayDoc, SleepWindow } from '../types';
import { startOptions } from './logSheetLogic';
import { sleepHours, withSleep } from './sleepLogic';
import { useWriteGate, writeErrorMessage } from './useWriteGate';
import './sleepSheet.css';

const TIME_OPTIONS = startOptions();

interface SleepSheetProps {
  uid: string;
  date: DateKey;
  doc: DayDoc | undefined;
  /** the window the jar currently shows: the day's own, or the default from settings */
  current: SleepWindow;
  /** default window from settings, used as the snapshot when the day doc has to be created */
  fallback: SleepWindow;
  loading: boolean;
  fromCache: boolean;
  settingsLoading: boolean;
  onClose: () => void;
}

const hoursText = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}h`;

export default function SleepSheet({
  uid,
  date,
  doc,
  current,
  fallback,
  loading,
  fromCache,
  settingsLoading,
  onClose,
}: SleepSheetProps) {
  const repo = useRepo();
  const toast = useToast();
  const { writable } = useWriteGate({ loading, fromCache, settingsLoading });
  const [start, setStart] = useState(current.start);
  const [end, setEnd] = useState(current.end);
  const [makeDefault, setMakeDefault] = useState(false);

  const valid = start !== end;
  const hours = sleepHours({ start, end });

  const save = () => {
    if (!valid || !writable) return;
    const next = withSleep(
      doc,
      { start, end },
      { fallback, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    );
    const onError = (e: unknown) => toast.error(writeErrorMessage(e));
    onClose();
    // not awaited: the local cache updates immediately and the write syncs when online
    repo.writeDays(uid, { [date]: next }).catch(onError);
    if (makeDefault) repo.saveSettings(uid, { sleepStart: start, sleepEnd: end }).catch(onError);
    toast.success('Sleep updated');
  };

  return (
    <BottomSheet titleId="sleep-sheet-title" onClose={onClose}>
      <div className="sheet-head">
        <h2 id="sleep-sheet-title">Sleep</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="sheet-body">
        <p className="muted sleep-date">{fullDate(date)}</p>
        <div className="row">
          <label className="field">
            Sleep start
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              {TIME_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Sleep end
            <select value={end} onChange={(e) => setEnd(e.target.value)}>
              {TIME_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {valid ? (
          <p className="muted" aria-live="polite">
            {hoursText(hours)} of sleep, shown only where nothing is logged
          </p>
        ) : (
          <p role="alert" className="error">
            Start and end can&apos;t be the same time.
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
          Also make this my default
        </label>
        {!writable && (
          <p className="muted" role="status">
            Syncing…
          </p>
        )}
      </div>
      <div className="sheet-foot">
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid || !writable}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
