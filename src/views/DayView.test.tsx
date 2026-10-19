// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { AuthBackend } from '../auth/types.ts';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import { DEFAULT_SETTINGS, type DayDoc } from '../types';
import DayView from './DayView.tsx';

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
  opts: { cacheOnly?: boolean; holdSettings?: boolean } = {},
) {
  const dayListeners = new Set<() => void>();
  let fromCache = opts.cacheOnly ?? false;
  let settingsCb: ((s: typeof DEFAULT_SETTINGS) => void) | null = null;
  const writeDays = vi.fn<Repo['writeDays']>(async () => {});
  const repo: Repo = {
    subscribeSettings(_uid, cb) {
      if (opts.holdSettings) settingsCb = cb;
      else queueMicrotask(() => cb(DEFAULT_SETTINGS));
      return () => {};
    },
    saveSettings: async () => {},
    subscribeDays(_uid, start, end, cb) {
      const emit = () =>
        cb(Object.fromEntries(Object.entries(initial).filter(([k]) => k >= start && k <= end)), {
          fromCache,
        });
      dayListeners.add(emit);
      queueMicrotask(emit);
      return () => {
        dayListeners.delete(emit);
      };
    },
    getDays: async () => ({}),
    writeDays,
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 14, 20));
});
afterEach(() => {
  cleanup();
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
    expect(await screen.findByText('Syncing…')).toBeTruthy();
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
