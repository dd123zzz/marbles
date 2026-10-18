import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';
const DATE = '2026-03-14';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-marbles',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

const alice = () => env.authenticatedContext(ALICE).firestore();
const bob = () => env.authenticatedContext(BOB).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const settings = (over: Record<string, unknown> = {}) => ({
  sleepStart: '23:00',
  sleepEnd: '07:00',
  weekStart: 'mon',
  v: 1,
  ...over,
});

const day = (over: Record<string, unknown> = {}) => ({
  slots: '.'.repeat(48),
  notes: {},
  sleep: { start: '23:00', end: '07:00' },
  tz: 'America/Los_Angeles',
  v: 1,
  updatedAt: serverTimestamp(),
  ...over,
});

async function seed(path: string[], data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const [first, ...rest] = path;
    await setDoc(doc(ctx.firestore(), first, ...rest), data);
  });
}

describe('users/{uid} settings', () => {
  it('lets the owner write and read their settings', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), settings()));
    await assertSucceeds(getDoc(doc(alice(), 'users', ALICE)));
  });

  it('accepts a theme and a partial merge', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), settings({ theme: 'dark' })));
    await assertSucceeds(
      setDoc(doc(alice(), 'users', ALICE), { weekStart: 'sun', v: 1 }, { merge: true }),
    );
  });

  it('denies another user read and write', async () => {
    await seed(['users', ALICE], settings());
    await assertFails(getDoc(doc(bob(), 'users', ALICE)));
    await assertFails(setDoc(doc(bob(), 'users', ALICE), settings()));
    await assertFails(deleteDoc(doc(bob(), 'users', ALICE)));
  });

  it('denies unauthenticated access', async () => {
    await seed(['users', ALICE], settings());
    await assertFails(getDoc(doc(anon(), 'users', ALICE)));
    await assertFails(setDoc(doc(anon(), 'users', ALICE), settings()));
  });

  it.each([
    ['weekStart tue', { weekStart: 'tue' }],
    ['sleepStart 23:15', { sleepStart: '23:15' }],
    ['sleepEnd 24:00', { sleepEnd: '24:00' }],
    ['sleepStart not a string', { sleepStart: 2300 }],
    ['theme neon', { theme: 'neon' }],
    ['extra key', { extra: 'x' }],
    ['v 2', { v: 2 }],
  ])('denies invalid settings: %s', async (_name, over) => {
    await assertFails(setDoc(doc(alice(), 'users', ALICE), settings(over)));
  });
});

describe('users/{uid}/days/{date}', () => {
  const ref = (db: ReturnType<typeof alice>, uid = ALICE, id = DATE) =>
    doc(db, 'users', uid, 'days', id);

  it('lets the owner write, read and delete a day', async () => {
    await assertSucceeds(setDoc(ref(alice()), day()));
    await assertSucceeds(getDoc(ref(alice())));
    await assertSucceeds(deleteDoc(ref(alice())));
  });

  it('accepts a full valid day with notes and reflection', async () => {
    await assertSucceeds(
      setDoc(
        ref(alice()),
        day({
          slots: 'gbr.'.repeat(12),
          notes: { '0': 'walk', '4': 'email' },
          reflection: 'x'.repeat(1000),
        }),
      ),
    );
  });

  it('denies another user read and write', async () => {
    await seed(['users', ALICE, 'days', DATE], { ...day(), updatedAt: new Date() });
    await assertFails(getDoc(ref(bob())));
    await assertFails(setDoc(ref(bob()), day()));
    await assertFails(deleteDoc(ref(bob())));
  });

  it('denies unauthenticated access', async () => {
    await assertFails(getDoc(ref(anon())));
    await assertFails(setDoc(ref(anon()), day()));
  });

  it.each([
    ['slots length 47', { slots: '.'.repeat(47) }],
    ['slots length 49', { slots: '.'.repeat(49) }],
    ['slots invalid char', { slots: 'x'.repeat(48) }],
    ['slots not a string', { slots: 42 }],
    ['extra field', { extra: 1 }],
    [
      'notes with 49 keys',
      { notes: Object.fromEntries(Array.from({ length: 49 }, (_, i) => [String(i), 'n'])) },
    ],
    ['updatedAt is a client date', { updatedAt: new Date() }],
    ['updatedAt missing', { updatedAt: undefined }],
    ['reflection 1001 chars', { reflection: 'x'.repeat(1001) }],
    ['tz too long', { tz: 'x'.repeat(65) }],
    ['sleep bad time', { sleep: { start: '25:00', end: '07:00' } }],
    ['sleep missing end', { sleep: { start: '23:00' } }],
    ['v 2', { v: 2 }],
  ])('denies invalid day: %s', async (_name, over) => {
    const data = day(over);
    if ('updatedAt' in over && over.updatedAt === undefined)
      delete (data as Record<string, unknown>).updatedAt;
    await assertFails(setDoc(ref(alice()), data));
  });

  it('denies a missing required field', async () => {
    const data = day() as Record<string, unknown>;
    delete data.tz;
    await assertFails(setDoc(ref(alice()), data));
  });

  it.each(['2026-3-14', '20260314', 'today', '2026-03-14-x'])(
    'denies bad date id %s',
    async (id) => {
      await assertFails(setDoc(ref(alice(), ALICE, id), day()));
    },
  );
});

describe('everything else', () => {
  it('denies unknown collections', async () => {
    await assertFails(setDoc(doc(alice(), 'other', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(alice(), 'users', ALICE, 'misc', 'x'), { a: 1 }));
  });
});
