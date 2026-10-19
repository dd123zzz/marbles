// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMarbles } from '../lib/jar';
import { emptySlots } from '../lib/entries';
import Jar from './Jar.tsx';
import MiniJar from './MiniJar.tsx';

afterEach(cleanup);

const now = new Date(2026, 9, 14, 14, 20);
const sleep = { start: '23:00', end: '07:00' };
// 13:00–13:30 wanted, 13:30–14:00 wasted
const slots = emptySlots().slice(0, 26) + 'gb' + emptySlots().slice(28);
const marbles = computeMarbles({ date: '2026-10-14', slots, sleep, now });

describe('Jar', () => {
  it('renders marble buttons: one per full marble, two per half marble', () => {
    render(<Jar marbles={marbles} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // 22 full marbles, plus the split 13:00 and 14:00 (now) marbles with 2 targets each
    expect(buttons).toHaveLength(26);
    for (const b of buttons) expect(b.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByLabelText('03:00–04:00 Sleep')).toBeTruthy();
    expect(
      screen.getByRole('group', { name: '13:00–13:30 Wanted, 13:30–14:00 Wasted' }),
    ).toBeTruthy();
  });

  it('exposes both halves of a half marble as separate focusable targets', () => {
    const onSelect = vi.fn();
    render(<Jar marbles={marbles} onSelect={onSelect} />);
    const left = screen.getByRole('button', { name: '13:00–13:30 Wanted' });
    const right = screen.getByRole('button', { name: '13:30–14:00 Wasted' });
    expect(left.getAttribute('tabindex')).toBe('0');
    expect(right.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(left, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(26, marbles[13]);
    fireEvent.keyDown(right, { key: ' ' });
    expect(onSelect).toHaveBeenLastCalledWith(27, marbles[13]);
    expect(onSelect).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(right, { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('keeps a full marble as one target, selectable by click and keyboard', () => {
    const onSelect = vi.fn();
    render(<Jar marbles={marbles} onSelect={onSelect} />);
    const sleep = screen.getByRole('button', { name: '03:00–04:00 Sleep' });
    expect(screen.queryByRole('button', { name: '03:00–03:30 Sleep' })).toBeNull();
    fireEvent.keyDown(sleep, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(6, marbles[3]);
    fireEvent.click(sleep);
    expect(onSelect).toHaveBeenLastCalledWith(6, marbles[3]);
  });

  it('selects the clicked half', () => {
    const onSelect = vi.fn();
    render(<Jar marbles={marbles} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '13:30–14:00 Wasted' }));
    expect(onSelect).toHaveBeenLastCalledWith(27, marbles[13]);
    fireEvent.click(screen.getByRole('button', { name: '13:00–13:30 Wanted' }));
    expect(onSelect).toHaveBeenLastCalledWith(26, marbles[13]);
  });

  it('has no buttons without onSelect', () => {
    render(<Jar marbles={marbles} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('MiniJar', () => {
  it('labels the day with its summary', () => {
    render(<MiniJar date="2026-10-14" marbles={marbles} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
      /^Wed Oct 14: G 0\.5h · B 0\.5h/,
    );
  });
});
