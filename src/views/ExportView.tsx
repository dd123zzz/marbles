import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useRepo } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { exportCounts, exportFilename, toCsv, toJson, isoWithOffset } from '../lib/export';
import { isValidDateKey, toDateKey } from '../lib/time';

type Preset = 'all' | 'month' | 'custom';
type Format = 'csv' | 'json';

export default function ExportView() {
  const { user } = useAuth();
  const repo = useRepo();
  const now = useNow();
  const today = toDateKey(now);
  const [preset, setPreset] = useState<Preset>('all');
  const [format, setFormat] = useState<Format>('csv');
  const [customStart, setCustomStart] = useState(`${today.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const range =
    preset === 'all'
      ? { start: '1970-01-01', end: today }
      : preset === 'month'
        ? { start: `${today.slice(0, 7)}-01`, end: today }
        : { start: customStart, end: customEnd };

  const rangeError =
    !isValidDateKey(range.start) || !isValidDateKey(range.end)
      ? 'Choose a start and end date.'
      : range.start > range.end
        ? 'The start date must be on or before the end date.'
        : '';

  const download = async () => {
    if (!user || rangeError) return;
    setBusy(true);
    setError('');
    setResult('');
    try {
      const days = await repo.getDays(user.uid, range.start, range.end);
      const text =
        format === 'csv'
          ? toCsv(days, range)
          : toJson(days, range, {
              exportedAt: isoWithOffset(new Date()),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
      const blob = new Blob([text], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename(range, format);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const counts = exportCounts(days, range);
      setResult(`${counts.days} days, ${counts.entries} entries exported`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>Export data</h1>
      <p className="muted">
        <Link to="/settings">‹ Settings</Link>
      </p>
      <fieldset>
        <legend>Date range</legend>
        {(
          [
            ['all', 'All data'],
            ['month', 'This month'],
            ['custom', 'Custom'],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="inline">
            <input
              type="radio"
              name="range"
              checked={preset === value}
              onChange={() => setPreset(value)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      {preset === 'custom' && (
        <div className="custom-range">
          <label className="field">
            Start date
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label className="field">
            End date
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
        </div>
      )}
      <fieldset>
        <legend>Format</legend>
        {(
          [
            ['csv', 'CSV'],
            ['json', 'JSON'],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="inline">
            <input
              type="radio"
              name="format"
              checked={format === value}
              onChange={() => setFormat(value)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      {rangeError && <p className="muted">{rangeError}</p>}
      <button
        type="button"
        className="primary"
        disabled={busy || !user || rangeError !== ''}
        onClick={() => void download()}
      >
        {busy ? 'Preparing…' : 'Download'}
      </button>
      {result && <p role="status">{result}</p>}
      {error && (
        <p role="alert" className="error">
          Could not export: {error}
        </p>
      )}
    </div>
  );
}
