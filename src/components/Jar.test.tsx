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
  it('renders 24 accessible marble buttons', () => {
    render(<Jar marbles={marbles} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(24);
    for (const b of buttons) expect(b.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByLabelText('13:00–13:30 Wanted, 13:30–14:00 Wasted')).toBeTruthy();
    expect(screen.getByLabelText('03:00–04:00 Sleep')).toBeTruthy();
  });

  it('selects the tapped half and supports the keyboard', () => {
    const onSelect = vi.fn();
    const { container } = render(<Jar marbles={marbles} onSelect={onSelect} />);
    const split = screen.getByLabelText('13:00–13:30 Wanted, 13:30–14:00 Wasted');
    fireEvent.click(split.querySelector('[data-half="1"]')!);
    expect(onSelect).toHaveBeenLastCalledWith(27, marbles[13]);
    fireEvent.click(split.querySelector('[data-half="0"]')!);
    expect(onSelect).toHaveBeenLastCalledWith(26, marbles[13]);
    fireEvent.keyDown(screen.getByLabelText('03:00–04:00 Sleep'), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(6, marbles[3]);
    expect(container.querySelectorAll('li')).toHaveLength(5);
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
