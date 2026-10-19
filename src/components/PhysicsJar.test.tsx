// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySlots } from '../lib/entries';
import { computeMarbles } from '../lib/jar';
import * as physics from '../lib/physics';
import type { Marble } from '../types';
import PhysicsJar, { type PhysicsJarHandle } from './PhysicsJar.tsx';

vi.mock('../lib/physics', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/physics')>();
  return { ...mod, createWorld: vi.fn(mod.createWorld) };
});

const sleep = { start: '23:00', end: '07:00' };
const DATE = '2026-10-14';

function marblesAt(h: number, min: number, slots = emptySlots()): Marble[] {
  return computeMarbles({ date: DATE, slots, sleep, now: new Date(2026, 9, 14, h, min) });
}

// 13:00–13:30 wanted, 13:30–14:00 wasted
const logged = emptySlots().slice(0, 26) + 'gb' + emptySlots().slice(28);
const at1420 = marblesAt(14, 20, logged);

const queue = new Map<number, FrameRequestCallback>();
let rafId = 0;
let clock = 0;
let rafCalls = 0;

function frame() {
  clock += 16;
  const cbs = [...queue.values()];
  queue.clear();
  for (const cb of cbs) cb(clock);
}

/** Runs frames until the loop stops by itself; returns how many it took. */
function runToRest(max = 1500): number {
  let n = 0;
  while (queue.size > 0 && n < max) {
    frame();
    n++;
  }
  return n;
}

const bodies = (c: HTMLElement) => [...c.querySelectorAll<SVGGElement>('.physics-marble')];
const hoursOf = (c: HTMLElement) => bodies(c).map((g) => Number(g.dataset.hour));

function pos(c: HTMLElement, hour: number): { x: number; y: number } {
  const t = c.querySelector(`.physics-marble[data-hour="${hour}"]`)?.getAttribute('transform');
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t ?? '');
  if (!m) throw new Error(`no transform for hour ${hour}: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** A jar drawn at 2 px per viewBox unit with its corner at (100, 50). */
function mockRect() {
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    right: 100 + 376,
    bottom: 50 + 628,
    width: 376,
    height: 628,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  queue.clear();
  rafId = 0;
  clock = 1000;
  rafCalls = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCalls++;
    queue.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.mocked(physics.createWorld).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'hidden');
});

describe('PhysicsJar bodies', () => {
  it('renders one body per started hour, gray ones included, in hour order', () => {
    const { container } = render(<PhysicsJar marbles={at1420} date={DATE} onSelect={() => {}} />);
    expect(hoursOf(container)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    // unlogged and sleep hours are there; future hours (15+) are not
    expect(screen.getByLabelText('09:00–10:00 Unlogged')).toBeTruthy();
    expect(screen.getByLabelText('03:00–04:00 Sleep')).toBeTruthy();
    expect(screen.queryByLabelText('15:00–16:00 Not yet')).toBeNull();
  });

  it('leaves out future hours and n/a hours', () => {
    const na: Marble = { hour: 2, left: 'na', right: 'na', full: true, label: '02:00–03:00 n/a' };
    const future: Marble = {
      hour: 3,
      left: 'empty',
      right: 'empty',
      full: true,
      label: '03:00–04:00 Not yet',
    };
    const marbles = [...at1420.slice(0, 2), na, future, ...at1420.slice(4)];
    const { container } = render(<PhysicsJar marbles={marbles} date={DATE} />);
    expect(hoursOf(container)).not.toContain(2);
    expect(hoursOf(container)).not.toContain(3);
    expect(bodies(container)).toHaveLength(13);
  });

  it('draws the not-yet-started half of the hour in progress as clear glass', () => {
    const { container } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    const halves = container.querySelectorAll('.physics-marble[data-hour="14"] path[data-half]');
    expect(halves).toHaveLength(2);
    expect(halves[0].getAttribute('class')).toContain('marble-unlogged');
    expect(halves[1].getAttribute('class')).toContain('marble-empty');
  });

  it('places every body inside the jar on the first paint', () => {
    const { container } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    for (const h of hoursOf(container)) {
      const p = pos(container, h);
      expect(p.x).toBeGreaterThan(16);
      expect(p.x).toBeLessThan(172);
      expect(p.y).toBeGreaterThan(100);
      expect(p.y).toBeLessThan(311);
    }
  });

  it('shows the hour number on each marble', () => {
    const { container } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    expect(container.querySelectorAll('.marble-hour')).toHaveLength(15);
  });
});

describe('PhysicsJar selection', () => {
  it('calls onSelect like the grid jar, with the slot and marble', () => {
    const onSelect = vi.fn();
    render(<PhysicsJar marbles={at1420} date={DATE} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '03:00–04:00 Sleep' }));
    expect(onSelect).toHaveBeenLastCalledWith(6, at1420[3]);
    fireEvent.click(screen.getByRole('button', { name: '13:30–14:00 Wasted' }));
    expect(onSelect).toHaveBeenLastCalledWith(27, at1420[13]);
    fireEvent.keyDown(screen.getByRole('button', { name: '13:00–13:30 Wanted' }), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(26, at1420[13]);
  });

  it('exposes a half marble as a group of two buttons and keeps tab order by hour', () => {
    render(<PhysicsJar marbles={at1420} date={DATE} onSelect={() => {}} />);
    expect(
      screen.getByRole('group', { name: '13:00–13:30 Wanted, 13:30–14:00 Wasted' }),
    ).toBeTruthy();
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels.slice(0, 3)).toEqual([
      '00:00–01:00 Sleep',
      '01:00–02:00 Sleep',
      '02:00–03:00 Sleep',
    ]);
    expect(labels.indexOf('13:30–14:00 Wasted')).toBe(labels.indexOf('13:00–13:30 Wanted') + 1);
    expect(labels.indexOf('13:00–13:30 Wanted')).toBeLessThan(
      labels.indexOf('14:00–14:30 Unlogged'),
    );
  });

  it('is not interactive without onSelect', () => {
    render(<PhysicsJar marbles={at1420} date={DATE} label="Wed jar" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Wed jar' })).toBeTruthy();
  });
});

describe('PhysicsJar loop', () => {
  it('stops requesting frames once the world sleeps', () => {
    const { container, rerender } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    runToRest();
    expect(queue.size).toBe(0);

    // 15:05: hour 15 starts and falls from the neck
    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} />);
    expect(hoursOf(container)).toContain(15);
    const spawn = pos(container, 15);
    expect(spawn.y).toBeLessThan(60);
    expect(queue.size).toBe(1);

    const frames = runToRest();
    expect(frames).toBeGreaterThan(5);
    expect(frames).toBeLessThan(400);
    expect(queue.size).toBe(0);
    expect(pos(container, 15).y).toBeGreaterThan(spawn.y + 80);

    const calls = rafCalls;
    frame();
    expect(rafCalls).toBe(calls);
  });

  it('does not run while at rest', () => {
    render(<PhysicsJar marbles={at1420} date={DATE} />);
    runToRest();
    const calls = rafCalls;
    runToRest();
    clock += 5000;
    expect(queue.size).toBe(0);
    expect(rafCalls).toBe(calls);
  });

  it('pauses while the page is hidden and resumes when it is visible again', () => {
    const { rerender } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    runToRest();
    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} />);
    expect(queue.size).toBe(1);

    act(() => setHidden(true));
    expect(queue.size).toBe(0);
    // a spawn while hidden does not start the loop either
    rerender(<PhysicsJar marbles={marblesAt(16, 5, logged)} date={DATE} />);
    expect(queue.size).toBe(0);

    act(() => setHidden(false));
    expect(queue.size).toBe(1);
    runToRest();
    expect(queue.size).toBe(0);
  });

  it('cancels the pending frame on unmount', () => {
    const { rerender, unmount } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    runToRest();
    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} />);
    expect(queue.size).toBe(1);
    unmount();
    expect(queue.size).toBe(0);
  });

  it('recolours in place and hops when a marble changes', () => {
    const { container, rerender } = render(
      <PhysicsJar marbles={at1420} date={DATE} onSelect={() => {}} />,
    );
    runToRest();
    const before = pos(container, 9);
    const edited = logged.slice(0, 18) + 'rr' + logged.slice(20);
    rerender(<PhysicsJar marbles={marblesAt(14, 20, edited)} date={DATE} onSelect={() => {}} />);
    expect(screen.queryByLabelText('09:00–10:00 Unlogged')).toBeNull();
    expect(screen.getByLabelText('09:00–10:00 Unwanted')).toBeTruthy();
    expect(hoursOf(container)).toHaveLength(15);
    expect(queue.size).toBe(1);
    frame();
    expect(pos(container, 9).y).toBeLessThan(before.y);
    runToRest();
    expect(queue.size).toBe(0);
  });

  it('wakes on a gravity change of more than a few degrees', () => {
    const { rerender } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    runToRest();
    rerender(<PhysicsJar marbles={at1420} date={DATE} gravity={{ x: 0.05, y: 1 }} />);
    expect(queue.size).toBe(0);
    rerender(<PhysicsJar marbles={at1420} date={DATE} gravity={{ x: 1, y: 1 }} />);
    expect(queue.size).toBe(1);
  });

  it('rebuilds the world when the date changes, not when only the marbles change', () => {
    const { rerender } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    expect(physics.createWorld).toHaveBeenCalledTimes(1);
    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} />);
    expect(physics.createWorld).toHaveBeenCalledTimes(1);
    rerender(<PhysicsJar marbles={at1420} date="2026-10-15" />);
    expect(physics.createWorld).toHaveBeenCalledTimes(2);
  });

  it('shows a rebuilt day already settled', () => {
    const { container, rerender } = render(<PhysicsJar marbles={at1420} date={DATE} />);
    rerender(<PhysicsJar marbles={at1420.slice(0, 8)} date="2026-10-15" />);
    expect(hoursOf(container)).toHaveLength(8);
    for (const h of hoursOf(container)) expect(pos(container, h).y).toBeGreaterThan(200);
  });
});

describe('PhysicsJar dropAt', () => {
  it('moves the hour to the release point, converted to jar units', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    const others = pos(container, 4);

    // (188, 250) px from the corner at 2 px/unit is (94, 125) in the jar
    act(() => ref.current?.dropAt(9, 100 + 188, 50 + 250, 0, 0));
    expect(pos(container, 9)).toEqual({ x: 94, y: 125 });
    expect(queue.size).toBe(1);
    runToRest();
    expect(pos(container, 9).y).toBeGreaterThan(125);
    expect(pos(container, 4).y).toBeGreaterThan(others.y - 1);
    expect(hoursOf(container)).toHaveLength(15);
  });

  it('gives the body the pointer velocity, scaled into jar units', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    // flicked up and to the right: 800 px/s is 400 jar units/s
    act(() => ref.current?.dropAt(9, 100 + 188, 50 + 500, 800, -800));
    frame();
    frame();
    const p = pos(container, 9);
    expect(p.x).toBeGreaterThan(94 + 2);
    expect(p.y).toBeLessThan(250);
  });

  it('keeps the point inside the glass', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    act(() => ref.current?.dropAt(9, 101, 50 + 626, 0, 0));
    const p = pos(container, 9);
    expect(p.x).toBeGreaterThanOrEqual(28);
    expect(p.y).toBeLessThanOrEqual(311 - 16);
    act(() => ref.current?.dropAt(8, 100 + 376, 51, 0, 0));
    expect(pos(container, 8).x).toBeLessThanOrEqual(188 - 28);
    expect(pos(container, 8).y).toBeGreaterThanOrEqual(30);
  });

  it('spawns at the neck when released outside the jar', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    act(() => ref.current?.dropAt(9, 20, 20, 500, 500));
    const p = pos(container, 9);
    expect(p.x).toBe(94);
    expect(p.y).toBeLessThan(45);
    expect(p.y).toBeGreaterThan(25);
  });

  it('places an hour that is not rendered yet when it appears, without a hop', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container, rerender } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    act(() => ref.current?.dropAt(15, 100 + 188, 50 + 250, 0, 0));
    expect(hoursOf(container)).not.toContain(15);
    rerender(<PhysicsJar ref={ref} marbles={marblesAt(15, 5, logged)} date={DATE} />);
    expect(pos(container, 15)).toEqual({ x: 94, y: 125 });
  });

  it('does not hop the dropped marble when its colour then changes', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container, rerender } = render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    runToRest();
    const impulse = vi.spyOn(vi.mocked(physics.createWorld).mock.results[0].value, 'impulse');
    act(() => ref.current?.dropAt(9, 100 + 188, 50 + 250, 0, 0));
    const edited = logged.slice(0, 18) + 'gg' + logged.slice(20);
    rerender(<PhysicsJar ref={ref} marbles={marblesAt(14, 20, edited)} date={DATE} />);
    expect(impulse).not.toHaveBeenCalled();
    expect(pos(container, 9)).toEqual({ x: 94, y: 125 });
  });

  it('reports the svg rect', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    render(<PhysicsJar ref={ref} marbles={at1420} date={DATE} />);
    expect(ref.current?.getRect()?.width).toBe(376);
  });
});

describe('PhysicsJar reduced motion', () => {
  it('renders a settled static layout with no frames', () => {
    const { container, rerender } = render(
      <PhysicsJar marbles={at1420} date={DATE} reducedMotion />,
    );
    expect(rafCalls).toBe(0);
    expect(bodies(container)).toHaveLength(15);
    for (const h of hoursOf(container)) expect(pos(container, h).y).toBeGreaterThan(100);

    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} reducedMotion />);
    expect(rafCalls).toBe(0);
    expect(pos(container, 15).y).toBeGreaterThan(100);
  });

  it('follows the prefers-reduced-motion media query', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    render(<PhysicsJar marbles={at1420} date={DATE} />);
    expect(rafCalls).toBe(0);
  });

  it('lets the prop override the media query', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })),
    );
    const { rerender } = render(<PhysicsJar marbles={at1420} date={DATE} reducedMotion={false} />);
    runToRest();
    rerender(<PhysicsJar marbles={marblesAt(15, 5, logged)} date={DATE} reducedMotion={false} />);
    expect(queue.size).toBe(1);
  });

  it('dropAt places the marble at rest without animating', () => {
    mockRect();
    const ref = createRef<PhysicsJarHandle>();
    const { container } = render(
      <PhysicsJar ref={ref} marbles={at1420} date={DATE} reducedMotion />,
    );
    act(() => ref.current?.dropAt(9, 100 + 188, 50 + 100, 0, 800));
    expect(rafCalls).toBe(0);
    expect(pos(container, 9).y).toBeGreaterThan(100);
  });

  it('ignores gravity changes', () => {
    const { rerender } = render(<PhysicsJar marbles={at1420} date={DATE} reducedMotion />);
    rerender(<PhysicsJar marbles={at1420} date={DATE} reducedMotion gravity={{ x: 1, y: 0 }} />);
    expect(rafCalls).toBe(0);
  });
});
