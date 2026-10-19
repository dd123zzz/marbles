import { useState } from 'react';
import { useRepo } from '../data/RepoProvider.tsx';
import { MAX_REFLECTION_LENGTH, withReflection } from '../lib/entries';
import type { DateKey, DayDoc, Settings } from '../types';
import { useToast } from '../components/Toast.tsx';
import { useWriteGate, writeErrorMessage } from './useWriteGate';
import './reflection.css';

interface ReflectionProps {
  uid: string;
  date: DateKey;
  doc: DayDoc | undefined;
  loading: boolean;
  fromCache: boolean;
  settings: Settings;
  settingsLoading: boolean;
}

const normalize = (text: string): string => text.trim().slice(0, MAX_REFLECTION_LENGTH);

/** Mount with `key={date}` so the draft and the cache grace period restart per day. */
export default function Reflection({
  uid,
  date,
  doc,
  loading,
  fromCache,
  settings,
  settingsLoading,
}: ReflectionProps) {
  const repo = useRepo();
  const toast = useToast();
  const { writable } = useWriteGate({ loading, fromCache, settingsLoading });
  const [draft, setDraft] = useState<string | null>(null);
  // What we last saved, until the stored value changes under us.
  const [saved, setSaved] = useState<{ base: string; value: string } | null>(null);

  const stored = doc?.reflection ?? '';
  const current = saved && saved.base === stored ? saved.value : stored;
  const text = draft ?? stored;
  const dirty = normalize(text) !== current;

  const save = () => {
    const next = withReflection(doc, text, {
      sleep: { start: settings.sleepStart, end: settings.sleepEnd },
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setSaved({ base: stored, value: next.reflection ?? '' });
    // not awaited: the local cache updates immediately and the write syncs when online
    repo.writeDays(uid, { [date]: next }).catch((e: unknown) => toast.error(writeErrorMessage(e)));
  };

  return (
    <section className="card">
      <h2 id="reflection-title">Reflection</h2>
      <textarea
        className="text-input"
        aria-labelledby="reflection-title"
        aria-describedby="reflection-count"
        rows={4}
        maxLength={MAX_REFLECTION_LENGTH}
        placeholder="How did the day go?"
        value={text}
        disabled={loading}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="reflection-foot">
        <p id="reflection-count" className="muted">
          {text.length}/{MAX_REFLECTION_LENGTH}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || !writable}
          onClick={save}
        >
          Save reflection
        </button>
      </div>
      {!loading && !writable && (
        <p className="muted" role="status">
          Waiting for sync before saving…
        </p>
      )}
    </section>
  );
}
