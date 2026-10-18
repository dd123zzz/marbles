import type { DateKey, DayDoc, Settings } from '../types.ts';

export type Unsubscribe = () => void;

export interface Repo {
  /** A missing settings doc yields DEFAULT_SETTINGS. */
  subscribeSettings(
    uid: string,
    cb: (s: Settings) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /** Merge write; always writes v:1. */
  saveSettings(uid: string, patch: Partial<Omit<Settings, 'v'>>): Promise<void>;
  /** Inclusive DateKey range, ONE query on documentId() — a month view is at most 31 reads. */
  subscribeDays(
    uid: string,
    start: DateKey,
    end: DateKey,
    cb: (days: Record<DateKey, DayDoc>) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /**
   * Write all given day docs in ONE batch (midnight-crossing entries touch 2 days).
   * Adds updatedAt. Resolves on server ack, so callers should not await it for offline UX.
   */
  writeDays(uid: string, days: Record<DateKey, DayDoc>): Promise<void>;
}
