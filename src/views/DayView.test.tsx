// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import { FLY_MS } from '../components/useMarbleDrag.ts';
import { JAR_STYLE_KEY } from '../hooks/useJarStyle';
import { TILT_STORAGE_KEY } from '../hooks/useDeviceTilt';
import DayView from './DayView.tsx';

const physics = vi.hoisted(() => ({ dropAt: vi.fn(), lastGravity: null as unknown }));

// The real PhysicsJar is covered by its own tests; here it only has to mount and expose its handle.
vi.mock('../components/PhysicsJar.tsx', async () => {
  const { useImperativeHandle } = await import('react');
  return {
    default: function PhysicsJarStub({
      ref,
      gravity,
      label,
    }: {
      ref?: React.Ref<unknown>;
      gravity?: { x: number; y: number };
      label?: string;
    }) {
      physics.lastGravity = gravity;
      useImperativeHandle(ref, () => ({ dropAt: physics.dropAt, getRect: () => null }), []);
      return (
        <div
          data-testid="physics-jar"
          data-gravity={gravity ? `${gravity.x},${gravity.y}` : ''}
          aria-label={label}
        />
      );
    },
  };
});

const auth: AuthBackend = {
  subscribe(cb) {
    queueMicrotask(() => cb({ uid: 'u1', email: 'a@b.c', displayName: null }));
    return () => {};
  },
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
};

function fakeRepo(
  initial: Record<string, DayDoc> = {},
  opts: { cacheOnly?: boolean; holdSettings?: boolean; applyWrites?: boolean } = {},
) {
  const store: Record<string, DayDoc> = { ...initial };
  const dayListeners = new Set<() => void>();
  let fromCache = opts.cacheOnly ?? false;
  let settingsCb: ((s: typeof DEFAULT_SETTINGS) => void) | null = null;
  const writeDays = vi.fn<Repo['writeDays']>(async (_uid, docs) => {
    if (!opts.applyWrites) return;
    Object.assign(store, docs);
    dayListeners.forEach((f) => f());
  });
  const repo: Repo = {
    subscribeSettings(_uid, cb) {
      if (opts.holdSettings) settingsCb = cb;
      else queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays(_uid, start, end, cb) {
      const emit = () =>
        cb(Object.fromEntries(Object.entries(store).filter(([k]) => k >= start && k <= end)), {
          fromCache,
        });
      dayListeners.add(emit);
      queueMicrotask(emit);
      return () => {
        dayListeners.delete(emit);
      };
    },
    getDays: async (_uid, start, end) =>
      Object.fromEntries(Object.entries(store).filter(([k]) => k >= start && k <= end)),
    writeDays,
    deleteAllData: async () => ({ deletedDays: 0 }),
  };
  return {
    repo,
    writeDays,
    serverArrives: () => {
      fromCache = false;
      dayListeners.forEach((f) => f());
    },
    loadSettings: () => settingsCb?.(DEFAULT_SETTINGS),
    settingsRequested: () => settingsCb !== null,
  };
}

function renderDay(repo: Repo, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider backend={auth}>
        <RepoProvider repo={repo}>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<DayView />} />
              <Route path="/day/:date" element={<DayView />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function openLogSheet() {
  const btn = (await screen.findByRole('button', { name: 'Log time' })) as HTMLButtonElement;
  await vi.waitFor(() => expect(btn.disabled).toBe(false));
  fireEvent.click(btn);
}

beforeEach(() => {
  // jsdom has no canvas; the share button then just stays disabled
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 14, 20));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('DayView', () => {
  it('logs the previous hour as Wanted in two taps', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await openLogSheet();
    const wanted = await screen.findByRole('button', { name: 'Wanted' });
    await vi.waitFor(() => expect((wanted as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(wanted);

    expect(writeDays).toHaveBeenCalledTimes(1);
    const [uid, docs] = writeDays.mock.calls[0];
    expect(uid).toBe('u1');
    expect(Object.keys(docs)).toEqual(['2026-10-14']);
    expect(docs['2026-10-14'].slots.slice(24, 30)).toBe('..gg..');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the edit sheet for a logged marble and deletes with confirmation', async () => {
    const slots = '.'.repeat(26) + 'gg' + '.'.repeat(20);
    const doc: DayDoc = {
      slots,
      notes: { '26': 'reading' },
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc });
    renderDay(repo);
    fireEvent.click(await screen.findByLabelText('13:00–14:00 Wanted'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Note (optional)') as HTMLInputElement).value).toBe('reading');
    const del = screen.getByRole('button', { name: 'Delete' });
    await vi.waitFor(() => expect((del as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(del);
    // the confirmation is a step inside the sheet, not window.confirm
    expect(screen.getByText('Delete this entry?')).toBeTruthy();
    expect(writeDays).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Note (optional)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(writeDays.mock.calls[0][1]['2026-10-14'].slots).toBe('.'.repeat(48));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before overwriting logged time and then saves', async () => {
    const slots = '.'.repeat(26) + 'bb' + '.'.repeat(20);
    const doc: DayDoc = {
      slots,
      notes: {},
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc });
    const confirm = vi.spyOn(window, 'confirm');
    renderDay(repo);
    await openLogSheet();
    const wanted = await screen.findByRole('button', { name: 'Wanted' });
    await vi.waitFor(() => expect((wanted as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(wanted);

    expect(screen.getByText('This overwrites 2 logged half-hours.')).toBeTruthy();
    expect(writeDays).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Wanted' })).toBeTruthy();
    expect(writeDays).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Wanted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }));
    expect(writeDays).toHaveBeenCalledTimes(1);
    expect(writeDays.mock.calls[0][1]['2026-10-14'].slots.slice(26, 28)).toBe('gg');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('closes the sheet with Escape or a backdrop tap and restores focus', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    const trigger = (await screen.findByRole('button', { name: 'Log time' })) as HTMLButtonElement;
    await vi.waitFor(() => expect(trigger.disabled).toBe(false));
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a toast, not an alert, when a write is rejected', async () => {
    const { repo, writeDays } = fakeRepo();
    writeDays.mockRejectedValueOnce(new Error('permission-denied'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderDay(repo);
    await openLogSheet();
    const wanted = await screen.findByRole('button', { name: 'Wanted' });
    await vi.waitFor(() => expect((wanted as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(wanted);
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toContain('Could not save your changes: permission-denied');
    expect(alert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an empty state when nothing is logged', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    expect(
      await screen.findByText('No marbles yet — tap Log time to add your first hour.'),
    ).toBeTruthy();
  });

  it('does not save from a cache-only snapshot until the server answers', async () => {
    const { repo, writeDays, serverArrives } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    expect(await within(await screen.findByRole('dialog')).findByText('Syncing…')).toBeTruthy();
    expect(wanted.disabled).toBe(true);
    serverArrives();
    await vi.waitFor(() => expect(wanted.disabled).toBe(false));
    expect(screen.queryByText('Syncing…')).toBeNull();
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
  });

  it('allows saving from the cache when offline', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { repo, writeDays } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    await vi.waitFor(() => expect(wanted.disabled).toBe(false));
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
    online.mockRestore();
  });

  it('allows saving from the cache after the grace period', async () => {
    const { repo, writeDays } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    await openLogSheet();
    const wanted = (await screen.findByRole('button', { name: 'Wanted' })) as HTMLButtonElement;
    expect(wanted.disabled).toBe(true);
    await vi.waitFor(() => expect(wanted.disabled).toBe(false), { timeout: 6000 });
    fireEvent.click(wanted);
    expect(writeDays).toHaveBeenCalledTimes(1);
  }, 10000);

  it('disables Log time until settings have loaded', async () => {
    const { repo, loadSettings, settingsRequested } = fakeRepo({}, { holdSettings: true });
    renderDay(repo);
    const btn = (await screen.findByRole('button', { name: 'Log time' })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await vi.waitFor(() => expect(settingsRequested()).toBe(true));
    act(() => loadSettings());
    await vi.waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('disables logging for a future day', async () => {
    const { repo } = fakeRepo();
    renderDay(repo, '/day/2026-10-20');
    const btn = await screen.findByRole('button', { name: 'Log time' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  describe('midnight-crossing entries', () => {
    const base = {
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    } as const;
    const crossingDays = (): Record<string, DayDoc> => ({
      '2026-10-13': { ...base, slots: '.'.repeat(46) + 'bb', notes: { '46': 'late' } },
      '2026-10-14': { ...base, slots: 'bb' + '.'.repeat(46), notes: { '0': 'late' } },
    });

    it('lists the entry with its range from either day', async () => {
      const { repo } = fakeRepo(crossingDays());
      renderDay(repo, '/day/2026-10-14');
      expect(await screen.findByText('Tue 23:00 – 01:00 · Wasted · late')).toBeTruthy();
      cleanup();
      renderDay(repo, '/day/2026-10-13');
      expect(await screen.findByText('23:00 – Wed 01:00 · Wasted · late')).toBeTruthy();
    });

    it('edits and deletes the whole entry from the later day', async () => {
      const { repo, writeDays } = fakeRepo(crossingDays());
      renderDay(repo, '/day/2026-10-14');
      fireEvent.click(await screen.findByLabelText('00:00–01:00 Wasted'));
      expect(await screen.findByRole('dialog')).toBeTruthy();
      expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-13');
      expect((screen.getByLabelText('Note (optional)') as HTMLInputElement).value).toBe('late');
      const del = screen.getByRole('button', { name: 'Delete' });
      await vi.waitFor(() => expect((del as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(del);
      fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
      const docs = writeDays.mock.calls[0][1];
      expect(docs['2026-10-13']).toMatchObject({ slots: '.'.repeat(48), notes: {} });
      expect(docs['2026-10-14']).toMatchObject({ slots: '.'.repeat(48), notes: {} });
    });

    it('changes the category on both days in one write', async () => {
      const { repo, writeDays } = fakeRepo(crossingDays());
      renderDay(repo, '/day/2026-10-13');
      fireEvent.click(await screen.findByLabelText('23:00–24:00 Wasted'));
      await screen.findByRole('dialog');
      const wanted = screen.getByRole('button', { name: 'Wanted' });
      await vi.waitFor(() => expect((wanted as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(wanted);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(writeDays).toHaveBeenCalledTimes(1);
      const docs = writeDays.mock.calls[0][1];
      expect(docs['2026-10-13'].slots.slice(44)).toBe('..gg');
      expect(docs['2026-10-14'].slots.slice(0, 4)).toBe('gg..');
    });
  });

  describe('reflection', () => {
    const base: DayDoc = {
      slots: '.'.repeat(48),
      notes: {},
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      reflection: 'calm day',
      v: 1,
    };

    it('shows the saved text with a counter and keeps Save disabled until changed', async () => {
      const { repo } = fakeRepo({ '2026-10-14': base });
      renderDay(repo);
      const box = (await screen.findByLabelText('Reflection')) as HTMLTextAreaElement;
      await vi.waitFor(() => expect(box.value).toBe('calm day'));
      expect(screen.getByText('8/1000')).toBeTruthy();
      const save = screen.getByRole('button', { name: 'Save reflection' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      fireEvent.change(box, { target: { value: 'calm day!' } });
      expect(screen.getByText('9/1000')).toBeTruthy();
      expect(box.maxLength).toBe(1000);
      await vi.waitFor(() => expect(save.disabled).toBe(false));
    });

    it('writes only that day, creating the doc when missing, and then disables Save', async () => {
      const { repo, writeDays } = fakeRepo();
      renderDay(repo);
      const box = (await screen.findByLabelText('Reflection')) as HTMLTextAreaElement;
      fireEvent.change(box, { target: { value: '  good  ' } });
      const save = screen.getByRole('button', { name: 'Save reflection' }) as HTMLButtonElement;
      await vi.waitFor(() => expect(save.disabled).toBe(false));
      fireEvent.click(save);
      expect(writeDays).toHaveBeenCalledTimes(1);
      const [uid, docs] = writeDays.mock.calls[0];
      expect(uid).toBe('u1');
      expect(Object.keys(docs)).toEqual(['2026-10-14']);
      expect(docs['2026-10-14']).toMatchObject({ reflection: 'good', notes: {}, v: 1 });
      expect(docs['2026-10-14'].slots).toBe('.'.repeat(48));
      expect(save.disabled).toBe(true);
    });

    it('clearing the text removes the reflection', async () => {
      const { repo, writeDays } = fakeRepo({ '2026-10-14': base });
      renderDay(repo);
      const box = (await screen.findByLabelText('Reflection')) as HTMLTextAreaElement;
      await vi.waitFor(() => expect(box.value).toBe('calm day'));
      fireEvent.change(box, { target: { value: '' } });
      const save = screen.getByRole('button', { name: 'Save reflection' }) as HTMLButtonElement;
      fireEvent.click(save);
      expect('reflection' in writeDays.mock.calls[0][1]['2026-10-14']).toBe(false);
    });

    it('blocks saving from a cache-only snapshot until the server answers', async () => {
      const { repo, writeDays, serverArrives } = fakeRepo({}, { cacheOnly: true });
      renderDay(repo);
      const box = (await screen.findByLabelText('Reflection')) as HTMLTextAreaElement;
      fireEvent.change(box, { target: { value: 'x' } });
      const save = screen.getByRole('button', { name: 'Save reflection' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      serverArrives();
      await vi.waitFor(() => expect(save.disabled).toBe(false));
      fireEvent.click(save);
      expect(writeDays).toHaveBeenCalledTimes(1);
    });

    it('is not shown for a future day', async () => {
      const { repo } = fakeRepo();
      renderDay(repo, '/day/2026-10-20');
      await screen.findByRole('button', { name: 'Log time' });
      expect(screen.queryByLabelText('Reflection')).toBeNull();
    });
  });
});

describe('DayView sleep and share', () => {
  const chipName = /^Edit sleep for Wed Oct 14/;

  it('edits the sleep of a day without a doc, creating it', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    const chip = await screen.findByRole('button', { name: chipName });
    chip.focus();
    fireEvent.click(chip);
    expect(await screen.findByRole('dialog', { name: 'Sleep' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sleep end'), { target: { value: '08:00' } });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await vi.waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    const doc = writeDays.mock.calls[0][1]['2026-10-14'];
    expect(doc.slots).toBe('.'.repeat(48));
    expect(doc.sleep).toEqual({ start: '23:00', end: '08:00' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('shows the day doc sleep on the chip and keeps its own window', async () => {
    const doc: DayDoc = {
      slots: '.'.repeat(48),
      notes: {},
      sleep: { start: '01:00', end: '03:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    };
    const { repo } = fakeRepo({ '2026-10-14': doc });
    renderDay(repo);
    const chip = await screen.findByRole('button', { name: chipName });
    expect(chip.textContent).toContain('Sleep 2h');
    fireEvent.click(chip);
    expect((screen.getByLabelText('Sleep start') as HTMLSelectElement).value).toBe('01:00');
  });

  it('allows editing sleep on a future day', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo, '/day/2026-10-20');
    fireEvent.click(await screen.findByRole('button', { name: /^Edit sleep for Tue Oct 20/ }));
    const save = await screen.findByRole('button', { name: 'Save' });
    await vi.waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(save);
    expect(Object.keys(writeDays.mock.calls[0][1])).toEqual(['2026-10-20']);
  });

  it('still opens the log sheet when a sleep marble is tapped', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    fireEvent.click(await screen.findByLabelText('00:00–01:00 Sleep'));
    expect(await screen.findByRole('dialog', { name: 'Log time' })).toBeTruthy();
  });

  it('has a share button for the day', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    expect(await screen.findByRole('button', { name: 'Share day image' })).toBeTruthy();
  });
});

describe('DayView drag-to-drop tray', () => {
  const PTR = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' };
  const base = {
    sleep: { start: '23:00', end: '07:00' },
    tz: 'America/Los_Angeles',
    v: 1,
  } as const;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 300,
      width: 52,
      height: 52,
      right: 152,
      bottom: 352,
      x: 100,
      y: 300,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  const marble = (name: string) =>
    screen.findByRole('button', { name: new RegExp(`^Log .* as ${name}$`) });

  async function dragOut(name: string) {
    const btn = await marble(name);
    fireEvent.pointerDown(btn, { ...PTR, clientX: 126, clientY: 326 });
    fireEvent.pointerMove(btn, { ...PTR, clientX: 126, clientY: 200 });
    fireEvent.pointerUp(btn, { ...PTR, clientX: 126, clientY: 200 });
  }

  const writable = () => vi.waitFor(() => expect(screen.queryByText('Syncing…')).toBeNull());

  it('shows the tray with the live window only on today', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    // empty day, sleep until 07:00: the catch-up window starts at wake-up, not at the last hour
    expect(await screen.findByText('Drag into the jar to log 07:00–08:00')).toBeTruthy();
    expect(await marble('Unwanted')).toBeTruthy();
    cleanup();
    renderDay(repo, '/day/2026-10-13');
    await screen.findByLabelText('Jar for Tue Oct 13');
    expect(screen.queryByRole('group', { name: /Marbles to log/ })).toBeNull();
    cleanup();
    renderDay(repo, '/day/2026-10-20');
    await screen.findByLabelText('Jar for Tue Oct 20');
    expect(screen.queryByRole('group', { name: /Marbles to log/ })).toBeNull();
  });

  it('hides the tray until settings have loaded', async () => {
    const { repo, loadSettings, settingsRequested } = fakeRepo({}, { holdSettings: true });
    renderDay(repo);
    await screen.findByLabelText('Jar for Wed Oct 14');
    await vi.waitFor(() => expect(settingsRequested()).toBe(true));
    expect(screen.queryByRole('group', { name: /Marbles to log/ })).toBeNull();
    expect(screen.queryByText(/Drag into the jar to log/)).toBeNull();
    act(() => loadSettings());
    expect(await screen.findByText('Drag into the jar to log 07:00–08:00')).toBeTruthy();
  });

  it('puts the summary chips under the jar, on every day', async () => {
    const { repo } = fakeRepo();
    for (const path of ['/', '/day/2026-10-13']) {
      renderDay(repo, path);
      const chips = await screen.findByRole('list', { name: 'Summary' });
      const jar = document.querySelector('.jar-slot')!;
      expect(jar.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Edit sleep for/ }).closest('.chips')).toBe(chips);
      cleanup();
    }
  });

  it('logs the first gap as the dropped category and offers Undo', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await writable();
    await dragOut('Wanted');

    expect(writeDays).toHaveBeenCalledTimes(1);
    const [uid, docs] = writeDays.mock.calls[0];
    expect(uid).toBe('u1');
    expect(Object.keys(docs)).toEqual(['2026-10-14']);
    expect(docs['2026-10-14'].slots.slice(12, 20)).toBe('..gg....');
    expect(screen.getByText('Logged 07:00–08:00 as Wanted')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dismisses the drop toast when the Day view unmounts', async () => {
    const { repo } = fakeRepo();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider backend={auth}>
          <RepoProvider repo={repo}>
            <ToastProvider>
              <Link to="/elsewhere">Leave</Link>
              <Routes>
                <Route path="/" element={<DayView />} />
                <Route path="/elsewhere" element={<p>Elsewhere</p>} />
              </Routes>
            </ToastProvider>
          </RepoProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await writable();
    await dragOut('Wanted');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
    await screen.findByText('Elsewhere');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByText('Logged 07:00–08:00 as Wanted')).toBeNull();
  });

  it('overwrites logged time and Undo restores it', async () => {
    const doc: DayDoc = {
      ...base,
      slots: '.'.repeat(26) + 'rbb' + '.'.repeat(19),
      notes: { '26': 'old note' },
    };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc }, { applyWrites: true });
    renderDay(repo);
    await writable();
    await dragOut('Wanted');
    expect(writeDays.mock.calls[0][1]['2026-10-14'].slots.slice(26, 30)).toBe('rgg.');
    // slot 26 stays unwanted (outside the window); 27 and 28 become wanted

    // the snapshot with the drop arrives, then Undo
    await vi.waitFor(() => expect(screen.getByLabelText('13:30–14:00 Wanted')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(writeDays).toHaveBeenCalledTimes(2));
    const restored = writeDays.mock.calls[1][1]['2026-10-14'];
    expect(restored.slots).toBe(doc.slots);
    expect(restored.notes).toEqual(doc.notes);
  });

  it('shows "already" and writes nothing when the window holds that category', async () => {
    const doc: DayDoc = { ...base, slots: '.'.repeat(27) + 'gg' + '.'.repeat(19), notes: {} };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc });
    renderDay(repo);
    await writable();
    await dragOut('Wanted');
    expect(writeDays).not.toHaveBeenCalled();
    expect(screen.getByText('13:30–14:30 is already Wanted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('logs on Enter without opening a sheet', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await writable();
    const btn = await marble('Wasted');
    btn.focus();
    fireEvent.click(btn, { detail: 0 });
    expect(writeDays).toHaveBeenCalledTimes(1);
    expect(writeDays.mock.calls[0][1]['2026-10-14'].slots.slice(14, 16)).toBe('bb');
    expect(document.activeElement).toBe(btn);
    expect(screen.getByText('Logged 07:00–08:00 as Wasted')).toBeTruthy();
  });

  it('does not log on a tap', async () => {
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await writable();
    const btn = await marble('Wanted');
    fireEvent.pointerDown(btn, { ...PTR, clientX: 126, clientY: 326 });
    fireEvent.pointerUp(btn, { ...PTR, clientX: 127, clientY: 326 });
    expect(writeDays).not.toHaveBeenCalled();
  });

  it('writes nothing until the data is writable, then works', async () => {
    const { repo, writeDays, serverArrives } = fakeRepo({}, { cacheOnly: true });
    renderDay(repo);
    expect(await screen.findByText('Syncing…')).toBeTruthy();
    const btn = await marble('Wanted');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    await dragOut('Wanted');
    fireEvent.click(btn, { detail: 0 });
    expect(writeDays).not.toHaveBeenCalled();

    serverArrives();
    await vi.waitFor(() => expect(btn.getAttribute('aria-disabled')).toBeNull());
    await dragOut('Wanted');
    expect(writeDays).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the write is rejected', async () => {
    const { repo, writeDays } = fakeRepo();
    writeDays.mockRejectedValueOnce(new Error('permission-denied'));
    renderDay(repo);
    await writable();
    await dragOut('Wanted');
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toContain('Could not save your changes: permission-denied');
  });

  it('writes both days in one batch for a window that crosses midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 14, 0, 20));
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await writable();
    await dragOut('Wanted');
    expect(writeDays).toHaveBeenCalledTimes(1);
    const docs = writeDays.mock.calls[0][1];
    expect(Object.keys(docs).sort()).toEqual(['2026-10-13', '2026-10-14']);
    expect(docs['2026-10-13'].slots.slice(46)).toBe('.g');
    expect(docs['2026-10-14'].slots.slice(0, 2)).toBe('g.');
    expect(screen.getByText('Logged 23:30–00:30 as Wanted')).toBeTruthy();
  });

  it('logs yesterday only just after midnight and says so', async () => {
    vi.setSystemTime(new Date(2026, 9, 14, 0, 5));
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await writable();
    expect(await screen.findByText('Drag into the jar to log yesterday 23:00–24:00')).toBeTruthy();
    await dragOut('Wanted');
    expect(Object.keys(writeDays.mock.calls[0][1])).toEqual(['2026-10-13']);
    expect(screen.getByText('Logged yesterday 23:00–24:00 as Wanted')).toBeTruthy();
  });

  it("Undo restores today's slot-0 mark after navigating away from the dropped days", async () => {
    vi.setSystemTime(new Date(2026, 9, 14, 0, 10));
    const doc: DayDoc = { ...base, slots: 'g' + '.'.repeat(47), notes: {} };
    const { repo, writeDays } = fakeRepo({ '2026-10-14': doc }, { applyWrites: true });
    renderDay(repo, '/day/2026-10-14');
    await writable();
    await dragOut('Wanted');
    const dropped = writeDays.mock.calls[0][1];
    expect(dropped['2026-10-13'].slots.slice(46)).toBe('gg');
    // the drop ends at 24:00, so it marks today's slot 0 as the start of its own entry
    expect(dropped['2026-10-14'].breaks?.[0]).toBe('|');

    // two days back: the view's range (Oct 11–13) no longer includes today
    for (const label of ['Previous day', 'Previous day']) {
      fireEvent.click(await screen.findByRole('link', { name: label }));
    }
    await screen.findByLabelText('Jar for Mon Oct 12');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(writeDays).toHaveBeenCalledTimes(2));
    const restored = writeDays.mock.calls[1][1];
    expect(restored['2026-10-13'].slots.slice(46)).toBe('..');
    expect(restored['2026-10-14'].breaks).toBeUndefined();
    expect(restored['2026-10-14'].slots).toBe(doc.slots);
  });

  describe('catch-up drops', () => {
    // 07:00–13:00 Wanted; at 14:20 the window ends at 14:30 (slot 29)
    const caughtThrough13: DayDoc = {
      ...base,
      slots: '.'.repeat(14) + 'g'.repeat(12) + '.'.repeat(22),
      notes: {},
    };
    // 07:00–14:30 Wanted: nothing left to catch up
    const caughtUp: DayDoc = {
      ...base,
      slots: '.'.repeat(14) + 'g'.repeat(15) + '.'.repeat(19),
      notes: {},
    };
    const entryLines = () =>
      Array.from(document.querySelectorAll('.entries li')).map((li) => li.textContent ?? '');

    it('writes the gap after the latest logged slot, not the last hour', async () => {
      const { repo, writeDays } = fakeRepo({ '2026-10-14': caughtThrough13 });
      renderDay(repo);
      await writable();
      expect(await screen.findByText('Drag into the jar to log 13:00–14:00')).toBeTruthy();
      await dragOut('Wasted');
      const slots = writeDays.mock.calls[0][1]['2026-10-14'].slots;
      expect(slots.slice(24, 30)).toBe('ggbb..');
      expect(screen.getByText('Logged 13:00–14:00 as Wasted')).toBeTruthy();
    });

    it('logs two consecutive drops of the same category as two Entries lines', async () => {
      const { repo, writeDays } = fakeRepo({}, { applyWrites: true });
      renderDay(repo);
      await writable();
      await dragOut('Wanted');
      await vi.waitFor(() => expect(entryLines()).toHaveLength(1));
      await vi.waitFor(() =>
        expect(screen.getByText('Drag into the jar to log 08:00–09:00')).toBeTruthy(),
      );
      await dragOut('Wanted');
      await vi.waitFor(() => expect(entryLines()).toHaveLength(2));
      expect(writeDays).toHaveBeenCalledTimes(2);
      expect(writeDays.mock.calls[1][1]['2026-10-14'].slots.slice(14, 18)).toBe('gggg');
      const [first, second] = entryLines();
      expect(first).toContain('07:00–08:00 · Wanted');
      expect(second).toContain('08:00–09:00 · Wanted');
    });

    it('advances to the next gap when the second drop has a different category', async () => {
      const { repo, writeDays } = fakeRepo({}, { applyWrites: true });
      renderDay(repo);
      await writable();
      await dragOut('Wanted');
      await vi.waitFor(() => expect(entryLines()).toHaveLength(1));
      await dragOut('Wasted');
      await vi.waitFor(() => expect(writeDays).toHaveBeenCalledTimes(2));
      expect(writeDays.mock.calls[1][1]['2026-10-14'].slots.slice(14, 18)).toBe('ggbb');
      expect(screen.getByText('Logged 08:00–09:00 as Wasted')).toBeTruthy();
      await vi.waitFor(() => expect(entryLines()).toHaveLength(2));
    });

    it('restores slots and breaks on Undo, and the next drop targets the same gap', async () => {
      const { repo, writeDays } = fakeRepo(
        { '2026-10-14': caughtThrough13 },
        { applyWrites: true },
      );
      renderDay(repo);
      await writable();
      await dragOut('Wanted');
      const dropped = writeDays.mock.calls[0][1]['2026-10-14'];
      expect(dropped.slots.slice(24, 30)).toBe('gggg..');
      expect(dropped.breaks?.[26]).toBe('|');
      await vi.waitFor(() => expect(entryLines()).toHaveLength(2));

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await vi.waitFor(() => expect(writeDays).toHaveBeenCalledTimes(2));
      const restored = writeDays.mock.calls[1][1]['2026-10-14'];
      expect(restored.slots).toBe(caughtThrough13.slots);
      expect(restored.breaks).toBeUndefined();
      await vi.waitFor(() => expect(entryLines()).toHaveLength(1));
      expect(await screen.findByText('Drag into the jar to log 13:00–14:00')).toBeTruthy();

      await dragOut('Wanted');
      expect(writeDays).toHaveBeenCalledTimes(3);
      expect(writeDays.mock.calls[2][1]['2026-10-14'].slots).toBe(dropped.slots);
      expect(screen.getByText('Logged 13:00–14:00 as Wanted')).toBeTruthy();
    });

    it('falls back to the last hour when caught up, and says "already" for the same category', async () => {
      const { repo, writeDays } = fakeRepo({ '2026-10-14': caughtUp });
      renderDay(repo);
      await writable();
      expect(await screen.findByText('Drag into the jar to log 13:30–14:30')).toBeTruthy();
      await dragOut('Wanted');
      expect(writeDays).not.toHaveBeenCalled();
      expect(screen.getByText('13:30–14:30 is already Wanted')).toBeTruthy();
    });

    it('recolors the last hour when caught up and the category differs', async () => {
      const { repo, writeDays } = fakeRepo({ '2026-10-14': caughtUp });
      renderDay(repo);
      await writable();
      await dragOut('Wasted');
      expect(writeDays.mock.calls[0][1]['2026-10-14'].slots.slice(26, 31)).toBe('gbb..');
      expect(screen.getByText('Logged 13:30–14:30 as Wasted')).toBeTruthy();
    });

    it('uses the day doc sleep, not the settings sleep, to find where the gap starts', async () => {
      // the day was saved with sleep until 09:00; settings say 07:00
      const doc: DayDoc = {
        ...base,
        slots: '.'.repeat(48),
        notes: {},
        sleep: { start: '23:00', end: '09:00' },
      };
      const { repo } = fakeRepo({ '2026-10-14': doc });
      renderDay(repo);
      await writable();
      expect(await screen.findByText('Drag into the jar to log 09:00–10:00')).toBeTruthy();
    });
  });
});

describe('DayView Loose jar', () => {
  const PTR = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' };
  const animate = vi.fn(() => ({}));

  beforeEach(() => {
    localStorage.clear();
    physics.dropAt.mockClear();
    animate.mockClear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 300,
      width: 52,
      height: 52,
      right: 152,
      bottom: 352,
      x: 100,
      y: 300,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  const marble = (name: string) =>
    screen.findByRole('button', { name: new RegExp(`^Log .* as ${name}$`) });
  const writable = () => vi.waitFor(() => expect(screen.queryByText('Syncing…')).toBeNull());
  async function dragOut(name: string) {
    const btn = await marble(name);
    fireEvent.pointerDown(btn, { ...PTR, clientX: 126, clientY: 326 });
    fireEvent.pointerMove(btn, { ...PTR, clientX: 126, clientY: 200 });
    fireEvent.pointerUp(btn, { ...PTR, clientX: 126, clientY: 200 });
  }
  const toggle = () => screen.findByRole('button', { name: 'Loose jar' });

  it('keeps the grid jar by default and switches to Loose with the toggle, saved per device', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    const btn = await toggle();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('physics-jar')).toBeNull();
    expect(screen.getByRole('group', { name: 'Jar for Wed Oct 14' })).toBeTruthy();

    fireEvent.click(btn);
    const jar = await screen.findByTestId('physics-jar');
    expect(jar.closest('.jar-slot')).toBeTruthy();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(JAR_STYLE_KEY)).toBe('loose');

    fireEvent.click(btn);
    expect(screen.queryByTestId('physics-jar')).toBeNull();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem(JAR_STYLE_KEY)).toBe('grid');
  });

  it('starts in Loose when the device saved it', async () => {
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    const { repo } = fakeRepo();
    renderDay(repo);
    expect(await screen.findByTestId('physics-jar')).toBeTruthy();
    expect((await toggle()).getAttribute('aria-pressed')).toBe('true');
  });

  it('drops each hour of the window at the release point and flies nothing', async () => {
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await screen.findByTestId('physics-jar');
    await writable();
    await dragOut('Wanted');

    expect(writeDays).toHaveBeenCalledTimes(1);
    // the first gap, 07:00–08:00, is one hour
    expect(physics.dropAt.mock.calls.map((c) => c[0])).toEqual([7]);
    for (const [, x, y, vx, vy] of physics.dropAt.mock.calls) {
      expect([x, y]).toEqual([126, 200]);
      expect(Number.isFinite(vx) && Number.isFinite(vy)).toBe(true);
    }
    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByText('Logged 07:00–08:00 as Wanted')).toBeTruthy();
  });

  it('drops a keyboard log at the neck', async () => {
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    const { repo } = fakeRepo();
    renderDay(repo);
    await screen.findByTestId('physics-jar');
    await writable();
    fireEvent.click(await marble('Wasted'), { detail: 0 });
    expect(physics.dropAt).toHaveBeenCalledTimes(1);
    const [, x, y, vx, vy] = physics.dropAt.mock.calls[0];
    expect(x).toBe(-Infinity);
    expect(y).toBe(-Infinity);
    expect([vx, vy]).toEqual([0, 0]);
  });

  it('keeps the grid fly-in and does not touch physics in Grid', async () => {
    const { repo } = fakeRepo();
    renderDay(repo);
    await writable();
    await dragOut('Wanted');
    expect(physics.dropAt).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalled();
  });

  it('does not spawn bodies for a yesterday-only window and keeps the ‹ fly-in', async () => {
    vi.setSystemTime(new Date(2026, 9, 14, 0, 5));
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    const { repo, writeDays } = fakeRepo();
    renderDay(repo);
    await screen.findByTestId('physics-jar');
    await writable();
    await dragOut('Wanted');
    expect(writeDays).toHaveBeenCalledTimes(1);
    expect(physics.dropAt).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalled();
  });

  it('only drops the hour that is on the viewed day when the window crosses midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 14, 0, 20));
    localStorage.setItem(JAR_STYLE_KEY, 'loose');
    const { repo } = fakeRepo();
    renderDay(repo);
    await screen.findByTestId('physics-jar');
    await writable();
    await dragOut('Wanted');
    // 23:30 yesterday → 00:30 today: only hour 0 is in today's jar
    expect(physics.dropAt.mock.calls.map((c) => c[0])).toEqual([0]);
  });

  describe('tilt', () => {
    const tiltBtn = () => screen.queryByRole('button', { name: /^(Enable tilt|Tilt on)$/ });
    const stubTilt = (coarse = true) => {
      vi.stubGlobal('DeviceOrientationEvent', class {});
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: coarse && query === '(pointer: coarse)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        })),
      );
    };

    it('is hidden in Grid, even where tilt is supported', async () => {
      stubTilt();
      const { repo } = fakeRepo();
      renderDay(repo);
      await toggle();
      expect(tiltBtn()).toBeNull();
    });

    it('is hidden in Loose on a device with a fine primary pointer (desktop)', async () => {
      stubTilt(false);
      localStorage.setItem(JAR_STYLE_KEY, 'loose');
      const { repo } = fakeRepo();
      renderDay(repo);
      await screen.findByTestId('physics-jar');
      expect(tiltBtn()).toBeNull();
    });

    it('is hidden in Loose when tilt is not supported', async () => {
      vi.stubGlobal('DeviceOrientationEvent', undefined);
      localStorage.setItem(JAR_STYLE_KEY, 'loose');
      const { repo } = fakeRepo();
      renderDay(repo);
      await screen.findByTestId('physics-jar');
      expect(tiltBtn()).toBeNull();
    });

    it('is hidden in Loose with reduced motion', async () => {
      stubTilt();
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: true,
          addEventListener: () => {},
          removeEventListener: () => {},
        })),
      );
      localStorage.setItem(JAR_STYLE_KEY, 'loose');
      const { repo } = fakeRepo();
      renderDay(repo);
      await screen.findByTestId('physics-jar');
      expect(tiltBtn()).toBeNull();
    });

    it('enables on tap, feeds gravity to the jar, and disables again', async () => {
      stubTilt();
      localStorage.setItem(JAR_STYLE_KEY, 'loose');
      const { repo } = fakeRepo();
      renderDay(repo);
      const jar = await screen.findByTestId('physics-jar');
      expect(jar.dataset.gravity).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Enable tilt' }));
      const on = await screen.findByRole('button', { name: 'Tilt on' });
      expect(on.getAttribute('aria-pressed')).toBe('true');
      expect(localStorage.getItem(TILT_STORAGE_KEY)).not.toBeNull();

      act(() => {
        window.dispatchEvent(
          Object.assign(new Event('deviceorientation'), { beta: 20, gamma: 20 }),
        );
      });
      await vi.waitFor(() => expect(jar.dataset.gravity).not.toBe(''));

      fireEvent.click(on);
      expect(await screen.findByRole('button', { name: 'Enable tilt' })).toBeTruthy();
      await vi.waitFor(() => expect(jar.dataset.gravity).toBe(''));
    });
  });
});

describe('marble-pop delay variable', () => {
  it('sets --marble-delay on popping marbles so the pop waits for the tray fly-in', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 14, 20));
    localStorage.clear();
    const doc: DayDoc = {
      slots: '.'.repeat(27) + 'gg' + '.'.repeat(19),
      notes: {},
      sleep: { start: '23:00', end: '07:00' },
      tz: 'America/Los_Angeles',
      v: 1,
    };
    const { repo } = fakeRepo({ '2026-10-14': doc }, { applyWrites: true });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 300,
      width: 52,
      height: 52,
      right: 152,
      bottom: 352,
      x: 100,
      y: 300,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    renderDay(repo);
    await vi.waitFor(() => expect(screen.queryByText('Syncing…')).toBeNull());
    const btn = await screen.findByRole('button', { name: /^Log .* as Wasted$/ });
    const PTR = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' };
    fireEvent.pointerDown(btn, { ...PTR, clientX: 126, clientY: 326 });
    fireEvent.pointerMove(btn, { ...PTR, clientX: 126, clientY: 200 });
    fireEvent.pointerUp(btn, { ...PTR, clientX: 126, clientY: 200 });
    await vi.waitFor(() => expect(document.querySelector('.marble-pop')).not.toBeNull());
    const popping = document.querySelectorAll<SVGGElement>('.marble-pop');
    for (const el of popping)
      expect(el.style.getPropertyValue('--marble-delay')).toBe(`${FLY_MS}ms`);
  });
});
