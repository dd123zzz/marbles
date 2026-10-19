import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import SegmentedControl from '../components/SegmentedControl.tsx';
import { useToast } from '../components/Toast.tsx';
import { useRepo } from '../data/RepoProvider.tsx';
import { useNow } from '../hooks/useNow';
import { exportCounts, exportFilename, toCsv, toJson, isoWithOffset } from '../lib/export';
import { isValidDateKey, toDateKey } from '../lib/time';
import './forms.css';

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

type Preset = 'all' | 'month' | 'custom';
type Format = 'csv' | 'json';

export default function ExportView() {
  const { user } = useAuth();
  const repo = useRepo();
  const toast = useToast();
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
      const summary = `${plural(counts.days, 'day')}, ${plural(counts.entries, 'entry', 'entries')} exported`;
      setResult(summary);
      toast.success(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <h1>Export data</h1>
      <p className="muted">
        <Link to="/settings">‹ Settings</Link>
      </p>
      <section className="card">
        <SegmentedControl
          legend="Date range"
          name="range"
          value={preset}
          options={[
            { value: 'all', label: 'All data' },
            { value: 'month', label: 'This month' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={setPreset}
        />
        {preset === 'custom' && (
          <div className="row">
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
        <SegmentedControl
          legend="Format"
          name="format"
          value={format}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' },
          ]}
          onChange={setFormat}
        />
        {rangeError && <p className="muted">{rangeError}</p>}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !user || rangeError !== ''}
          onClick={() => void download()}
        >
          {busy ? 'Preparing…' : 'Download'}
        </button>
        {error && (
          <p role="alert" className="error">
            Could not export: {error}
          </p>
        )}
      </section>
      <section className="card">
        <h2>Export status</h2>
        <p className="muted">
          {result
            ? `Last export: ${result}.`
            : 'Nothing exported yet. Choose a range and format, then tap Download. Your file is saved to this device.'}
        </p>
      </section>
    </div>
  );
}
