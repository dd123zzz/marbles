// @vitest-environment jsdom
import { cleanup, waitFor, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarbleTray from './MarbleTray.tsx';
import type { DropResult } from './useMarbleDrag.ts';

const RECT = {
  left: 100,
  top: 300,
  width: 52,
  height: 52,
  right: 152,
  bottom: 352,
  x: 100,
  y: 300,
};
const PTR = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' };
const HOME = { clientX: 126, clientY: 326 };

let vibrate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    ...RECT,
    toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'vibrate');
});

function setup(props: { writable?: boolean; result?: DropResult | void; jar?: DOMRect } = {}) {
  const onDrop = vi.fn(() => props.result);
  const onArmedChange = vi.fn();
  render(
    <MarbleTray
      rangeLabel="13:30–14:30"
      writable={props.writable ?? true}
      onDrop={onDrop}
      onArmedChange={onArmedChange}
      getDropTargetRect={props.jar ? () => props.jar! : undefined}
    />,
  );
  const wanted = screen.getByRole('button', { name: 'Log 13:30–14:30 as Productive' });
  return { onDrop, onArmedChange, wanted };
}

const overlay = () => document.querySelector('.tray-overlay');
const move = (el: Element, dx: number, dy = 0) =>
  fireEvent.pointerMove(el, { ...PTR, clientX: HOME.clientX + dx, clientY: HOME.clientY + dy });
const down = (el: Element) => fireEvent.pointerDown(el, { ...PTR, ...HOME });
const up = (el: Element, dx: number, dy = 0) =>
  fireEvent.pointerUp(el, { ...PTR, clientX: HOME.clientX + dx, clientY: HOME.clientY + dy });

describe('MarbleTray', () => {
  it('renders four labelled marbles in display order and the live hint', () => {
    setup();
    const names = ['Purposeful', 'Productive', 'Unwanted', 'Wasted'];
    for (const name of names) {
      expect(screen.getByRole('button', { name: `Log 13:30–14:30 as ${name}` })).toBeTruthy();
    }
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(names.map((n) => `Log 13:30–14:30 as ${n}`));
    expect(screen.getByText('Drag into the jar to log 13:30–14:30')).toBeTruthy();
  });

  it('does not log on a tap and pulses the hint', () => {
    const { onDrop, wanted } = setup();
    down(wanted);
    move(wanted, 3, 2);
    up(wanted, 3, 2);
    expect(onDrop).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
    expect(screen.getByText('Drag into the jar to log 13:30–14:30').className).toBe('is-pulsing');
  });

  it('lifts into an overlay, arms the jar, and logs on release once clear of home', () => {
    const { onDrop, onArmedChange, wanted } = setup();
    down(wanted);
    move(wanted, 0, -20);
    expect(overlay()).not.toBeNull();
    expect(wanted.className).toContain('is-lifted');
    expect(onArmedChange).not.toHaveBeenCalled();
    move(wanted, 0, -60);
    expect(onArmedChange).toHaveBeenLastCalledWith('g');
    expect(vibrate).toHaveBeenCalledWith(10);
    up(wanted, 0, -80);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith(
      'g',
      expect.objectContaining({ clientX: 126, clientY: 246, source: 'pointer' }),
    );
    expect(vibrate).toHaveBeenLastCalledWith(20);
    expect(onArmedChange).toHaveBeenLastCalledWith(null);
    expect(overlay()).toBeNull();
  });

  it('vibrates only the first time a drag becomes valid', () => {
    const { wanted } = setup();
    down(wanted);
    move(wanted, 0, -60);
    move(wanted, 0, -70);
    expect(vibrate.mock.calls.filter(([ms]) => ms === 10)).toHaveLength(1);
  });

  it('does not log a short drag that stays close to home', () => {
    const { onDrop, wanted } = setup();
    down(wanted);
    move(wanted, 30);
    up(wanted, 30);
    expect(onDrop).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it('cancels when dragged back home before release', () => {
    const { onDrop, onArmedChange, wanted } = setup();
    down(wanted);
    move(wanted, 0, -80);
    expect(onArmedChange).toHaveBeenLastCalledWith('g');
    move(wanted, 10, -10);
    expect(onArmedChange).toHaveBeenLastCalledWith(null);
    up(wanted, 10, -10);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it.each([
    ['pointercancel', (el: Element) => fireEvent.pointerCancel(el, PTR)],
    ['lostpointercapture', (el: Element) => fireEvent.lostPointerCapture(el, PTR)],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    [
      'the page going hidden',
      () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        fireEvent(document, new Event('visibilitychange'));
      },
    ],
  ])('cancels on %s', (_name, cancel) => {
    const { onDrop, onArmedChange, wanted } = setup();
    down(wanted);
    move(wanted, 0, -80);
    cancel(wanted);
    expect(overlay()).toBeNull();
    expect(onArmedChange).toHaveBeenLastCalledWith(null);
    up(wanted, 0, -80);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('springs back when the drop is not accepted', () => {
    const { onDrop, wanted } = setup({ result: { accepted: false } });
    down(wanted);
    move(wanted, 0, -80);
    up(wanted, 0, -80);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(overlay()).toBeNull();
  });

  it('flies the overlay with the Web Animations API and removes it when done', async () => {
    const animate = vi.fn(() => {
      const anim: { onfinish?: () => void } = {};
      queueMicrotask(() => anim.onfinish?.());
      return anim;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    try {
      const jar = { left: 40, top: 100, width: 200, height: 300 } as DOMRect;
      const { wanted } = setup({ jar });
      down(wanted);
      move(wanted, 0, -80);
      up(wanted, 0, -80);
      expect(animate).toHaveBeenCalledTimes(1);
      const frames = (animate.mock.calls[0] as unknown as [Keyframe[]])[0];
      // lands at the jar's top centre (140, 100 + 8% of 300), minus the 26px radius
      expect(frames[1].transform).toContain('translate3d(114px, 98px, 0)');
      expect(overlay()).not.toBeNull();
      await waitFor(() => expect(overlay()).toBeNull());
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    }
  });

  it('blocks touchmove scrolling only while a marble is held', () => {
    const { wanted } = setup();
    const touchmove = () => {
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(touchmove()).toBe(false);
    down(wanted);
    expect(touchmove()).toBe(true);
    expect(document.documentElement.classList.contains('marble-dragging')).toBe(true);
    up(wanted, 0);
    expect(touchmove()).toBe(false);
    expect(document.documentElement.classList.contains('marble-dragging')).toBe(false);
  });

  it('ignores a second pointer while one marble is held', () => {
    const { onDrop, wanted } = setup();
    const wasted = screen.getByRole('button', { name: 'Log 13:30–14:30 as Wasted' });
    down(wanted);
    fireEvent.pointerDown(wasted, { ...PTR, pointerId: 2, isPrimary: false, ...HOME });
    move(wanted, 0, -80);
    fireEvent.pointerUp(wasted, { ...PTR, pointerId: 2, isPrimary: false });
    expect(onDrop).not.toHaveBeenCalled();
    up(wanted, 0, -80);
    expect(onDrop).toHaveBeenCalledWith('g', expect.anything());
  });

  it('logs on Enter or Space (click without a pointer) and leaves focus alone', () => {
    const { onDrop, wanted } = setup();
    wanted.focus();
    fireEvent.click(wanted, { detail: 0 });
    expect(onDrop).toHaveBeenCalledWith('g', expect.objectContaining({ source: 'keyboard' }));
    expect(document.activeElement).toBe(wanted);
    fireEvent.click(wanted, { detail: 1 });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('is aria-disabled and writes nothing while not writable', () => {
    const { onDrop, onArmedChange, wanted } = setup({ writable: false });
    expect(screen.getByText('Syncing…')).toBeTruthy();
    expect(screen.queryByText(/Drag into the jar/)).toBeNull();
    expect(wanted.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('group').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(wanted, { detail: 0 });
    down(wanted);
    move(wanted, 0, -80);
    expect(onArmedChange).not.toHaveBeenCalledWith('g');
    up(wanted, 0, -80);
    expect(onDrop).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it('ignores secondary mouse buttons', () => {
    const { onDrop, wanted } = setup();
    fireEvent.pointerDown(wanted, { ...PTR, pointerType: 'mouse', button: 2, ...HOME });
    move(wanted, 0, -80);
    up(wanted, 0, -80);
    expect(onDrop).not.toHaveBeenCalled();
  });
});
