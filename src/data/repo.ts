import type { DateKey, DayDoc, Settings } from '../types.ts';

export type Unsubscribe = () => void;

export interface SnapshotMeta {
  /** True while the data comes only from the local cache and may be incomplete. */
  fromCache: boolean;
}

export interface Repo {
  /** A missing settings doc yields DEFAULT_SETTINGS. */
  subscribeSettings(
    uid: string,
    cb: (s: Settings) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /** Merge write; always writes v:1. */
  saveSettings(uid: string, patch: Partial<Omit<Settings, 'v'>>): Promise<void>;
  /**
   * Inclusive DateKey range, ONE query on documentId() — a month view is at most 31 reads.
   * A fromCache snapshot may lack docs that exist on the server, so do not build writes from it.
   */
  subscribeDays(
    uid: string,
    start: DateKey,
    end: DateKey,
    cb: (days: Record<DateKey, DayDoc>, meta: SnapshotMeta) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /** One-shot read of the same inclusive range as subscribeDays (used by export). */
  getDays(uid: string, start: DateKey, end: DateKey): Promise<Record<DateKey, DayDoc>>;
  /**
   * Write all given day docs in ONE batch (midnight-crossing entries touch 2 days).
   * Adds updatedAt. Resolves on server ack, so callers should not await it for offline UX.
   */
  writeDays(uid: string, days: Record<DateKey, DayDoc>): Promise<void>;
  /**
   * Permanently deletes every day doc and the settings doc for this user (the account stays).
   * Needs a connection: the day list comes from the server, never the cache. Active
   * subscribers update on their own.
   */
  deleteAllData(uid: string): Promise<{ deletedDays: number }>;
}
