/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type DateKey, type DayDoc, type Settings } from '../types.ts';
import { createMemoryRepo } from './memoryRepo.ts';
import type { Repo } from './repo.ts';

const RepoContext = createContext<Repo | null>(null);

export const isDemo = import.meta.env.VITE_DEMO === 'true';

async function createRepo(): Promise<Repo> {
  if (isDemo) return createMemoryRepo();
  // Dynamic import keeps Firebase out of the demo path entirely.
  const { createFirestoreRepo } = await import('./firestoreRepo.ts');
  return createFirestoreRepo();
}

export function RepoProvider({ children, repo: provided }: { children: ReactNode; repo?: Repo }) {
  const [repo, setRepo] = useState<Repo | null>(provided ?? null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (provided) return;
    let cancelled = false;
    createRepo().then(
      (r) => !cancelled && setRepo(r),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      cancelled = true;
    };
  }, [provided]);

  if (error) return <p role="alert">Could not start the data layer: {error.message}</p>;
  if (!repo) return <p>Loading…</p>;
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repo {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepo must be used inside <RepoProvider>');
  return repo;
}

export function useSettings(uid: string | undefined): { settings: Settings; loading: boolean } {
  const repo = useRepo();
  const [state, setState] = useState<{ uid: string; settings: Settings } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return repo.subscribeSettings(uid, (settings) => setState({ uid, settings }));
  }, [repo, uid]);

  const ready = !!uid && state?.uid === uid;
  return { settings: ready ? state.settings : DEFAULT_SETTINGS, loading: !ready };
}

interface DaysState {
  key: string;
  days: Record<DateKey, DayDoc>;
  fromCache: boolean;
  error: Error | null;
}
const NO_DAYS: Record<DateKey, DayDoc> = {};

export function useDays(
  uid: string | undefined,
  start: DateKey,
  end: DateKey,
): { days: Record<DateKey, DayDoc>; loading: boolean; fromCache: boolean; error: Error | null } {
  const repo = useRepo();
  const [state, setState] = useState<DaysState | null>(null);
  const key = `${uid}|${start}|${end}`;

  useEffect(() => {
    if (!uid) return;
    return repo.subscribeDays(
      uid,
      start,
      end,
      (days, meta) => setState({ key, days, fromCache: meta.fromCache, error: null }),
      (error) => setState({ key, days: NO_DAYS, fromCache: false, error }),
    );
  }, [repo, uid, start, end, key]);

  const ready = !!uid && state?.key === key;
  return {
    days: ready ? state.days : NO_DAYS,
    loading: !ready,
    fromCache: ready ? state.fromCache : false,
    error: ready ? state.error : null,
  };
}
