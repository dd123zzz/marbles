import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebase } from '../firebase.ts';
import { DEFAULT_SETTINGS, type DateKey, type DayDoc, type Settings } from '../types.ts';
import type { Repo } from './repo.ts';

function toDayDoc(data: DocumentData): DayDoc {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt, ...rest } = data;
  return rest as DayDoc;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function toSettings(data: DocumentData | undefined): Settings {
  if (!data) return DEFAULT_SETTINGS;
  return {
    sleepStart: data.sleepStart ?? DEFAULT_SETTINGS.sleepStart,
    sleepEnd: data.sleepEnd ?? DEFAULT_SETTINGS.sleepEnd,
    weekStart: data.weekStart ?? DEFAULT_SETTINGS.weekStart,
    v: 1,
  };
}

export function createFirestoreRepo(): Repo {
  const { db } = getFirebase();

  return {
    subscribeSettings(uid, cb, onError) {
      return onSnapshot(
        doc(db, 'users', uid),
        { includeMetadataChanges: false },
        (snap) => cb(toSettings(snap.data())),
        (e) => onError?.(e),
      );
    },

    saveSettings(uid, patch) {
      return setDoc(doc(db, 'users', uid), { ...stripUndefined(patch), v: 1 }, { merge: true });
    },

    subscribeDays(uid, start, end, cb, onError) {
      const q = query(
        collection(db, 'users', uid, 'days'),
        where(documentId(), '>=', start),
        where(documentId(), '<=', end),
      );
      return onSnapshot(
        q,
        { includeMetadataChanges: false },
        (snap) => {
          const days: Record<DateKey, DayDoc> = {};
          snap.forEach((d) => {
            days[d.id] = toDayDoc(d.data());
          });
          cb(days);
        },
        (e) => onError?.(e),
      );
    },

    writeDays(uid, days) {
      const batch = writeBatch(db);
      for (const [date, day] of Object.entries(days)) {
        batch.set(doc(db, 'users', uid, 'days', date), {
          ...stripUndefined(day),
          updatedAt: serverTimestamp(),
        });
      }
      return batch.commit();
    },
  };
}
