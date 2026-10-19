import { useEffect, useRef } from 'react';
import { useRepo } from '../data/RepoProvider.tsx';
import { defaultStart } from '../lib/time';
import type { DateKey, DayDoc, Settings } from '../types';
import { BOUNDARY_SLACK_MS, hourlyNotification, nextHourBoundary, showReminder } from './notify';

export interface TodaySnapshot {
  date: DateKey;
  doc: DayDoc | undefined;
  settings: Settings;
  ready: boolean;
}

/**
 * At the top of each hour, notifies if the previous hour is awake and unlogged.
 * Best effort: only runs while the app is open. The latest data is read through
 * a ref so the timer is not re-armed on every snapshot.
 */
export function useHourlyNotification(
  uid: string | undefined,
  enabled: boolean,
  snapshot: TodaySnapshot,
): void {
  const repo = useRepo();
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  });

  useEffect(() => {
    if (!enabled || !uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const fire = async (boundary: Date) => {
      const snap = latest.current;
      if (!snap.ready) return;
      const { date } = defaultStart(boundary);
      let prevDoc = snap.doc;
      if (date !== snap.date) {
        // the hour before midnight belongs to yesterday, which is not subscribed
        try {
          prevDoc = (await repo.getDays(uid, date, date))[date];
        } catch {
          return;
        }
      }
      if (cancelled) return;
      const n = hourlyNotification({ boundary, now: new Date(), prevDoc, settings: snap.settings });
      if (n) await showReminder(n).catch(() => {});
    };

    const arm = () => {
      clearTimeout(timer);
      const boundary = nextHourBoundary(new Date());
      timer = setTimeout(
        () => {
          void fire(boundary);
          arm();
        },
        boundary.getTime() - Date.now() + BOUNDARY_SLACK_MS,
      );
    };
    // Browsers throttle timers in background tabs; re-aim when the tab comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') arm();
    };

    arm();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, uid, repo]);
}
