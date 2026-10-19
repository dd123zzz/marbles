import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebase } from '../firebase.ts';
import {
  DEFAULT_SETTINGS,
  type DateKey,
  type DayDoc,
  type Settings,
  type ThemePref,
} from '../types.ts';
import type { Repo } from './repo.ts';

function toDayDoc(data: DocumentData): DayDoc {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt, ...rest } = data;
  return rest as DayDoc;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function isThemePref(v: unknown): v is ThemePref {
  return v === 'system' || v === 'light' || v === 'dark';
}

function toSettings(data: DocumentData | undefined): Settings {
  if (!data) return DEFAULT_SETTINGS;
  return {
    sleepStart: data.sleepStart ?? DEFAULT_SETTINGS.sleepStart,
    sleepEnd: data.sleepEnd ?? DEFAULT_SETTINGS.sleepEnd,
    weekStart: data.weekStart ?? DEFAULT_SETTINGS.weekStart,
    theme: isThemePref(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
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
        { includeMetadataChanges: true },
        (snap) => {
          const days: Record<DateKey, DayDoc> = {};
          snap.forEach((d) => {
            days[d.id] = toDayDoc(d.data());
          });
          cb(days, { fromCache: snap.metadata.fromCache });
        },
        (e) => onError?.(e),
      );
    },

    async getDays(uid, start, end) {
      const q = query(
        collection(db, 'users', uid, 'days'),
        where(documentId(), '>=', start),
        where(documentId(), '<=', end),
      );
      const snap = await getDocs(q);
      const days: Record<DateKey, DayDoc> = {};
      snap.forEach((d) => {
        days[d.id] = toDayDoc(d.data());
      });
      return days;
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
