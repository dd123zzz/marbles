// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast.tsx';
import { RepoProvider } from '../data/RepoProvider.tsx';
import type { Repo } from '../data/repo.ts';
import type { DayDoc } from '../types';
import SleepSheet from './SleepSheet.tsx';
import { sleepHours, withSleep } from './sleepLogic';

afterEach(cleanup);

const doc: DayDoc = {
  slots: '.'.repeat(24) + 'gg' + '.'.repeat(22),
  notes: { '24': 'x' },
  sleep: { start: '23:00', end: '07:00' },
  tz: 'America/Los_Angeles',
  reflection: 'ok',
  v: 1,
};

function setup(props: { doc?: DayDoc; fromCache?: boolean; saveRejects?: boolean } = {}) {
  const writeDays = vi.fn<Repo['writeDays']>(async () => {});
  const saveSettings = vi.fn<Repo['saveSettings']>(async () => {
    if (props.saveRejects) throw new Error('nope');
  });
  const repo = { writeDays, saveSettings } as unknown as Repo;
  const onClose = vi.fn();
  render(
    <RepoProvider repo={repo}>
      <ToastProvider>
        <SleepSheet
          uid="u1"
          date="2026-10-14"
          doc={props.doc}
          current={props.doc?.sleep ?? { start: '22:00', end: '06:30' }}
          fallback={{ start: '22:00', end: '06:30' }}
          loading={false}
          fromCache={props.fromCache ?? false}
          settingsLoading={false}
          onClose={onClose}
        />
      </ToastProvider>
    </RepoProvider>,
  );
  return { writeDays, saveSettings, onClose };
}

const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe('SleepSheet', () => {
  it('starts from the current window and shows the resulting hours', () => {
    setup({ doc });
    expect((screen.getByLabelText('Sleep start') as HTMLSelectElement).value).toBe('23:00');
    expect((screen.getByLabelText('Sleep end') as HTMLSelectElement).value).toBe('07:00');
    expect(screen.getByText(/^8h of sleep/)).toBeTruthy();
    pick('Sleep end', '06:30');
    expect(screen.getByText(/^7.5h of sleep/)).toBeTruthy();
  });

  it('saves only the sleep of an existing doc, keeping everything else', () => {
    const { writeDays, saveSettings, onClose } = setup({ doc });
    pick('Sleep start', '00:30');
    pick('Sleep end', '08:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(writeDays).toHaveBeenCalledTimes(1);
    expect(writeDays.mock.calls[0][0]).toBe('u1');
    expect(writeDays.mock.calls[0][1]).toEqual({
      '2026-10-14': { ...doc, sleep: { start: '00:30', end: '08:00' } },
    });
    expect(saveSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Sleep updated')).toBeTruthy();
  });

  it('creates the day doc when none exists', () => {
    const { writeDays } = setup();
    pick('Sleep end', '07:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = writeDays.mock.calls[0][1]['2026-10-14'];
    expect(saved.slots).toBe('.'.repeat(48));
    expect(saved.notes).toEqual({});
    expect(saved.sleep).toEqual({ start: '22:00', end: '07:00' });
    expect(saved.v).toBe(1);
    expect(typeof saved.tz).toBe('string');
  });

  it('also saves the default window when the checkbox is ticked', () => {
    const { writeDays, saveSettings } = setup({ doc });
    pick('Sleep start', '22:30');
    fireEvent.click(screen.getByLabelText('Also make this my default'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(writeDays).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith('u1', { sleepStart: '22:30', sleepEnd: '07:00' });
  });

  it('refuses an identical start and end', () => {
    const { writeDays } = setup({ doc });
    pick('Sleep end', '23:00');
    expect(screen.getByRole('alert').textContent).toMatch(/can.t be the same/);
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(writeDays).not.toHaveBeenCalled();
  });

  it('waits for a server-confirmed snapshot before saving', () => {
    const { writeDays } = setup({ doc, fromCache: true });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(writeDays).not.toHaveBeenCalled();
  });

  it('reports a rejected default-settings save in a toast', async () => {
    setup({ doc, saveRejects: true });
    fireEvent.click(screen.getByLabelText('Also make this my default'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Could not save your changes: nope/)).toBeTruthy();
  });

  it('closes on Cancel without writing', () => {
    const { writeDays, onClose } = setup({ doc });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(writeDays).not.toHaveBeenCalled();
  });
});

describe('sleepLogic', () => {
  it('computes hours across midnight and returns 0 for equal times', () => {
    expect(sleepHours({ start: '23:00', end: '07:00' })).toBe(8);
    expect(sleepHours({ start: '01:00', end: '09:30' })).toBe(8.5);
    expect(sleepHours({ start: '07:00', end: '07:00' })).toBe(0);
  });

  it('does not mutate the original doc', () => {
    const next = withSleep(doc, { start: '01:00', end: '02:00' }, { fallback: doc.sleep, tz: 'x' });
    expect(doc.sleep).toEqual({ start: '23:00', end: '07:00' });
    expect(next.notes).not.toBe(doc.notes);
  });
});
