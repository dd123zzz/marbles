// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMarbles } from '../lib/jar';
import { emptySlots } from '../lib/entries';
import type { Marble } from '../types';
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

describe('hour numbers', () => {
  it('shows hours 0–23 in the day jar, hidden from assistive tech', () => {
    const { container } = render(<Jar marbles={marbles} onSelect={() => {}} />);
    const texts = [...container.querySelectorAll('text.marble-hour')];
    expect(texts.map((t) => t.textContent)).toEqual(Array.from({ length: 24 }, (_, i) => `${i}`));
    for (const t of texts) {
      expect(t.getAttribute('aria-hidden')).toBe('true');
      expect(t.getAttribute('pointer-events')).toBe('none');
    }
  });

  it('shows no numbers in a mini jar', () => {
    const { container } = render(<MiniJar date="2026-10-14" marbles={marbles} />);
    expect(container.querySelectorAll('.marble-hour')).toHaveLength(0);
  });

  it('picks the hour ink per marble: Wasted and Unlogged differ, split marbles stay dark', () => {
    const set = (hour: number, left: Marble['left'], right: Marble['right']) => ({
      hour,
      left,
      right,
      full: left === right,
    });
    const mixed = marbles.map((m) => {
      if (m.hour === 0) return { ...m, ...set(0, 'b', 'b') };
      if (m.hour === 1) return { ...m, ...set(1, 'unlogged', 'unlogged') };
      if (m.hour === 2) return { ...m, ...set(2, 'g', 'g') };
      if (m.hour === 3) return { ...m, ...set(3, 'b', 'r') };
      return m;
    });
    const { container } = render(<Jar marbles={mixed} />);
    const cls = (hour: number) =>
      [...container.querySelectorAll('text.marble-hour')]
        .find((t) => t.textContent === `${hour}`)
        ?.getAttribute('class');
    expect(cls(0)).toBe('marble-hour marble-hour-b');
    expect(cls(1)).toBe('marble-hour marble-hour-unlogged');
    expect(cls(2)).toBe('marble-hour');
    expect(cls(3)).toBe('marble-hour');
  });

  it('shows n/a instead of a number on a nonexistent DST hour', () => {
    const dst = marbles.map((m) =>
      m.hour === 2 ? { ...m, left: 'na' as const, right: 'na' as const } : m,
    );
    const { container } = render(<Jar marbles={dst} />);
    expect(container.querySelectorAll('.marble-hour')).toHaveLength(23);
    expect(container.querySelector('.marble-na-text')?.textContent).toBe('n/a');
  });
});

describe('marble animations', () => {
  const log = (base: typeof marbles, hours: number[], c: 'g' | 'b' = 'g') =>
    base.map((m) => (hours.includes(m.hour) ? { ...m, left: c, right: c, full: true } : m));
  const animated = (container: HTMLElement) =>
    [...container.querySelectorAll('.marble-anim')].map((g) => ({
      cls: g.getAttribute('class'),
      delay: (g as SVGGElement).style.getPropertyValue('--marble-delay'),
      hour: g.querySelector('text')?.textContent,
    }));

  it('does not animate on first render', () => {
    const { container } = render(<Jar marbles={log(marbles, [8, 9])} date="2026-10-14" />);
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
  });

  it('drops newly logged hours, staggered by hour, and ignores the rest', () => {
    const { container, rerender } = render(<Jar marbles={marbles} date="2026-10-14" />);
    rerender(<Jar marbles={log(marbles, [9, 5])} date="2026-10-14" />);
    expect(animated(container)).toEqual([
      { cls: 'marble-anim marble-drop', delay: '0ms', hour: '5' },
      { cls: 'marble-anim marble-drop', delay: '40ms', hour: '9' },
    ]);
  });

  it('clears the class when the animation ends so a later log animates again', () => {
    const { container, rerender } = render(<Jar marbles={marbles} date="2026-10-14" />);
    const next = log(marbles, [5]);
    rerender(<Jar marbles={next} date="2026-10-14" />);
    // jsdom has no `animation` style property, so React listens for the webkit-prefixed event
    fireEvent(
      container.querySelector('.marble-anim')!,
      new Event('webkitAnimationEnd', { bubbles: true }),
    );
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
  });

  it('does not re-trigger when the same marbles are re-computed', () => {
    const { container, rerender } = render(<Jar marbles={marbles} date="2026-10-14" />);
    rerender(<Jar marbles={marbles.map((m) => ({ ...m }))} date="2026-10-14" />);
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
  });

  it('pops a marble that moves between logged categories', () => {
    const { container, rerender } = render(<Jar marbles={log(marbles, [5])} date="2026-10-14" />);
    rerender(<Jar marbles={log(marbles, [5], 'b')} date="2026-10-14" />);
    expect(animated(container).map((a) => a.cls)).toEqual(['marble-anim marble-pop']);
  });

  it('does not animate when the date changes', () => {
    const { container, rerender } = render(<Jar marbles={marbles} date="2026-10-14" />);
    rerender(<Jar marbles={log(marbles, [5, 6])} date="2026-10-15" />);
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
    rerender(<Jar marbles={log(marbles, [5, 6, 7])} date="2026-10-15" />);
    expect(animated(container).map((a) => a.hour)).toEqual(['7']);
  });

  it('uses the label as the day key when no date is given', () => {
    const { container, rerender } = render(<Jar marbles={marbles} label="Jar for Oct 14" />);
    rerender(<Jar marbles={log(marbles, [5])} label="Jar for Oct 15" />);
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
  });

  it('does not animate mini jars', () => {
    const { container, rerender } = render(<MiniJar date="2026-10-14" marbles={marbles} />);
    rerender(<MiniJar date="2026-10-14" marbles={log(marbles, [5])} />);
    expect(container.querySelectorAll('.marble-anim')).toHaveLength(0);
  });
});

describe('MiniJar', () => {
  it('draws no marbles and says nothing logged when nothingLogged', () => {
    const { container } = render(<MiniJar date="2026-10-14" marbles={marbles} nothingLogged />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Wed Oct 14: nothing logged');
    expect(container.querySelectorAll('.marble')).toHaveLength(0);
    expect(container.querySelector('.jar-outline')).not.toBeNull();
  });

  it('labels the day with its summary', () => {
    render(<MiniJar date="2026-10-14" marbles={marbles} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
      /^Wed Oct 14: G 0\.5h · B 0\.5h/,
    );
  });
});

describe('Jar dropDelayMs', () => {
  const doc = (slots: string) => computeMarbles({ date: '2026-10-14', slots, sleep, now });
  const delayOf = (container: HTMLElement) =>
    [...container.querySelectorAll<SVGElement>('.marble-anim')].map((el) =>
      el.style.getPropertyValue('--marble-delay'),
    );

  it('postpones the entrance animation of marbles that change', () => {
    const before = doc(emptySlots());
    const after = doc(emptySlots().slice(0, 26) + 'gg' + emptySlots().slice(28));
    const { container, rerender } = render(<Jar marbles={before} date="2026-10-14" />);
    expect(delayOf(container)).toEqual([]);
    rerender(<Jar marbles={after} date="2026-10-14" dropDelayMs={180} />);
    expect(delayOf(container)).toEqual(['180ms']);
  });

  it('adds no delay by default', () => {
    const before = doc(emptySlots());
    const after = doc(emptySlots().slice(0, 26) + 'gg' + emptySlots().slice(28));
    const { container, rerender } = render(<Jar marbles={before} date="2026-10-14" />);
    rerender(<Jar marbles={after} date="2026-10-14" />);
    expect(delayOf(container)).toEqual(['0ms']);
  });
});
