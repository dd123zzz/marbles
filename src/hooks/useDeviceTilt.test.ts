// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TILT_STORAGE_KEY, tiltToGravity, useDeviceTilt, type TiltGravity } from './useDeviceTilt';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  Reflect.deleteProperty(screen, 'orientation');
  Reflect.deleteProperty(window, 'orientation');
});

function near(g: TiltGravity, x: number, y: number) {
  expect(g.x).toBeCloseTo(x, 5);
  expect(g.y).toBeCloseTo(y, 5);
}

describe('tiltToGravity', () => {
  it('points down the screen when upright, facing the user', () => {
    near(tiltToGravity(90, 0, 0), 0, 1);
  });

  it('leans toward the side the phone is tilted to', () => {
    const right = tiltToGravity(90, 30, 0);
    const left = tiltToGravity(90, -30, 0);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeGreaterThan(0);
    expect(left.x).toBeCloseTo(-right.x, 5);
    expect(left.y).toBeCloseTo(right.y, 5);
  });

  it('points up the screen when upside down', () => {
    near(tiltToGravity(-90, 0, 0), 0, -1);
  });

  it('follows the on-screen frame in landscape', () => {
    // Content turned counter-clockwise: physical "down" is the content's left edge.
    near(tiltToGravity(90, 0, 90), -1, 0);
    near(tiltToGravity(90, 0, 270), 1, 0);
    near(tiltToGravity(90, 0, 180), 0, -1);
  });

  it('keeps marbles falling down-screen when flat, but weaker', () => {
    const flat = tiltToGravity(0, 0, 0);
    near(flat, 0, 0.25);
    const upright = tiltToGravity(90, 0, 0);
    expect(Math.hypot(flat.x, flat.y)).toBeLessThan(Math.hypot(upright.x, upright.y));
  });

  it('scales strength with the tilt, so a 45° front-back tilt is weaker than upright', () => {
    near(tiltToGravity(45, 0, 0), 0, Math.SQRT1_2);
  });

  it('always returns a finite vector with strength in [0.25, 1]', () => {
    for (let beta = -180; beta <= 180; beta += 15) {
      for (let gamma = -90; gamma <= 90; gamma += 15) {
        for (const angle of [0, 90, 180, 270]) {
          const g = tiltToGravity(beta, gamma, angle);
          const len = Math.hypot(g.x, g.y);
          expect(Number.isFinite(len)).toBe(true);
          expect(len).toBeGreaterThanOrEqual(0.25 - 1e-9);
          expect(len).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });
});

/** Fires a `deviceorientation` event on the window. */
function fire(beta: number | null, gamma: number | null) {
  const ev = new Event('deviceorientation');
  Object.assign(ev, { beta, gamma });
  act(() => {
    window.dispatchEvent(ev);
  });
}

/** Makes `(pointer: coarse)` match (a phone) or not (a desktop with a mouse). */
function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: coarse && query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

/** Android-like: no permission prompt. */
function stubAndroid() {
  stubPointer(true);
  vi.stubGlobal('DeviceOrientationEvent', class {});
}

/** iOS 13+: requestPermission exists and resolves to the given result. */
function stubIOS(result: string | Error = 'granted') {
  stubPointer(true);
  const requestPermission = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  vi.stubGlobal('DeviceOrientationEvent', { requestPermission });
  return requestPermission;
}

/** Mounts the hook and records every gravity value it renders. */
function mount(enabledPref = true) {
  const gravities: (TiltGravity | null)[] = [];
  const hook = renderHook(() => {
    const tilt = useDeviceTilt(enabledPref);
    gravities.push(tilt.gravity);
    return tilt;
  });
  return { ...hook, gravities };
}

function countChanges(values: (TiltGravity | null)[]): number {
  let count = 0;
  let prev: TiltGravity | null = null;
  for (const v of values) {
    if (v !== prev) count++;
    prev = v;
  }
  return count;
}

describe('useDeviceTilt', () => {
  it('reports unsupported and refuses to enable without DeviceOrientationEvent', async () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    const { result } = mount();
    expect(result.current.supported).toBe(false);
    expect(result.current.needsPermission).toBe(false);
    expect(result.current.enabled).toBe(false);
    let ok = true;
    await act(async () => {
      ok = await result.current.enable();
    });
    expect(ok).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(TILT_STORAGE_KEY)).toBeNull();
  });

  it('is unsupported where the primary pointer is not coarse, even with DeviceOrientationEvent', async () => {
    vi.stubGlobal('DeviceOrientationEvent', class {});
    stubPointer(false);
    const { result } = mount();
    expect(result.current.supported).toBe(false);
    let ok = true;
    await act(async () => {
      ok = await result.current.enable();
    });
    expect(ok).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(TILT_STORAGE_KEY)).toBeNull();
  });

  it('is unsupported when matchMedia is missing', () => {
    vi.stubGlobal('DeviceOrientationEvent', class {});
    vi.stubGlobal('matchMedia', undefined);
    expect(mount().result.current.supported).toBe(false);
  });

  it('is off by default and starts listening on Android once enabled', async () => {
    stubAndroid();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = mount();
    expect(result.current.supported).toBe(true);
    expect(result.current.needsPermission).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(addSpy).not.toHaveBeenCalledWith('deviceorientation', expect.anything());

    let ok = false;
    await act(async () => {
      ok = await result.current.enable();
    });
    expect(ok).toBe(true);
    expect(result.current.enabled).toBe(true);
    expect(addSpy).toHaveBeenCalledWith('deviceorientation', expect.any(Function));

    fire(90, 0);
    near(result.current.gravity!, 0, 1);
  });

  it('stays off when the caller gate is closed, even if stored on', () => {
    stubAndroid();
    localStorage.setItem(TILT_STORAGE_KEY, 'on');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = mount(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.gravity).toBeNull();
    expect(addSpy).not.toHaveBeenCalledWith('deviceorientation', expect.anything());
  });

  it('auto-starts on Android when the stored choice is on', () => {
    stubAndroid();
    localStorage.setItem(TILT_STORAGE_KEY, 'on');
    const { result } = mount(true);
    expect(result.current.enabled).toBe(true);
  });

  it('treats any stored value other than "on" as off', () => {
    stubAndroid();
    localStorage.setItem(TILT_STORAGE_KEY, 'yes please');
    expect(mount(true).result.current.enabled).toBe(false);
  });

  it('remembers the choice across mounts', async () => {
    stubAndroid();
    const first = mount(true);
    await act(async () => {
      await first.result.current.enable();
    });
    expect(localStorage.getItem(TILT_STORAGE_KEY)).toBe('on');
    first.unmount();
    expect(mount(true).result.current.enabled).toBe(true);
  });

  describe('iOS permission', () => {
    it('does not auto-start a stored "on" without a tap', () => {
      const requestPermission = stubIOS();
      localStorage.setItem(TILT_STORAGE_KEY, 'on');
      const { result } = mount(true);
      expect(result.current.needsPermission).toBe(true);
      expect(result.current.enabled).toBe(false);
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('asks for permission in enable() and starts once granted', async () => {
      const requestPermission = stubIOS('granted');
      const { result } = mount(true);
      let ok = false;
      await act(async () => {
        ok = await result.current.enable();
      });
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(ok).toBe(true);
      expect(result.current.enabled).toBe(true);
      expect(localStorage.getItem(TILT_STORAGE_KEY)).toBe('on');
      fire(90, 0);
      near(result.current.gravity!, 0, 1);
    });

    it('stays disabled when permission is denied', async () => {
      const requestPermission = stubIOS('denied');
      const addSpy = vi.spyOn(window, 'addEventListener');
      const { result } = mount(true);
      let ok = true;
      await act(async () => {
        ok = await result.current.enable();
      });
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(ok).toBe(false);
      expect(result.current.enabled).toBe(false);
      expect(result.current.gravity).toBeNull();
      expect(addSpy).not.toHaveBeenCalledWith('deviceorientation', expect.anything());
      expect(localStorage.getItem(TILT_STORAGE_KEY)).toBeNull();
    });

    it('treats a rejected permission request as denied', async () => {
      stubIOS(new Error('not from a gesture'));
      const { result } = mount(true);
      let ok = true;
      await act(async () => {
        ok = await result.current.enable();
      });
      expect(ok).toBe(false);
      expect(result.current.enabled).toBe(false);
    });
  });

  describe('disable and unmount', () => {
    it('removes the listener, clears gravity and stores off', async () => {
      stubAndroid();
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { result } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      fire(90, 0);
      const handler = addSpy.mock.calls.find((c) => c[0] === 'deviceorientation')?.[1];

      act(() => result.current.disable());
      expect(result.current.enabled).toBe(false);
      expect(result.current.gravity).toBeNull();
      expect(localStorage.getItem(TILT_STORAGE_KEY)).toBe('off');
      expect(removeSpy).toHaveBeenCalledWith('deviceorientation', handler);
    });

    it('removes the listener on unmount', async () => {
      stubAndroid();
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { result, unmount } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      const handler = addSpy.mock.calls.find((c) => c[0] === 'deviceorientation')?.[1];
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('deviceorientation', handler);
    });
  });

  describe('events', () => {
    it('ignores events with null beta or gamma', async () => {
      stubAndroid();
      vi.useFakeTimers();
      const { result, gravities } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      fire(null, 0);
      fire(90, null);
      expect(result.current.gravity).toBeNull();
      expect(countChanges(gravities)).toBe(0);
    });

    it('throttles updates to 30 Hz and emits the latest value as a trailing update', async () => {
      stubAndroid();
      vi.useFakeTimers();
      const { result, gravities } = mount(true);
      await act(async () => {
        await result.current.enable();
      });

      fire(90, 0); // leading edge: emits at once
      near(result.current.gravity!, 0, 1);

      act(() => vi.advanceTimersByTime(10));
      fire(60, 0);
      act(() => vi.advanceTimersByTime(10));
      fire(30, 0);
      near(result.current.gravity!, 0, 1); // nothing new yet

      act(() => vi.advanceTimersByTime(20)); // past the 33 ms window
      near(result.current.gravity!, 0, 0.5); // latest value (beta 30), not beta 60
      expect(countChanges(gravities)).toBe(2);
    });

    it('caps emissions at 30 per second under a fast event stream', async () => {
      stubAndroid();
      vi.useFakeTimers();
      const { result, gravities } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      // A steady ramp (0.6° per 10 ms) so every 33 ms flush is a real change (about 2°).
      for (let i = 0; i < 100; i++) {
        fire(90, i * 0.6);
        act(() => vi.advanceTimersByTime(10));
      }
      const emitted = countChanges(gravities);
      expect(emitted).toBeGreaterThanOrEqual(25);
      expect(emitted).toBeLessThanOrEqual(31);
    });

    it('skips changes smaller than about 1°', async () => {
      stubAndroid();
      vi.useFakeTimers();
      const { result, gravities } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      fire(90, 0);
      act(() => vi.advanceTimersByTime(40));
      const before = countChanges(gravities);

      fire(90, 0.5); // about 0.5° of gamma: below the threshold
      act(() => vi.advanceTimersByTime(40));
      expect(countChanges(gravities)).toBe(before);

      fire(90, 3); // about 3°: emits
      act(() => vi.advanceTimersByTime(40));
      expect(countChanges(gravities)).toBe(before + 1);
    });
  });

  describe('screen orientation', () => {
    it('rotates gravity by screen.orientation.angle', async () => {
      stubAndroid();
      Object.defineProperty(screen, 'orientation', { value: { angle: 90 }, configurable: true });
      const { result } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      fire(90, 0);
      near(result.current.gravity!, -1, 0);
    });

    it('falls back to window.orientation when the Screen Orientation API is missing', async () => {
      stubAndroid();
      Object.defineProperty(window, 'orientation', { value: -90, configurable: true });
      const { result } = mount(true);
      await act(async () => {
        await result.current.enable();
      });
      fire(90, 0);
      near(result.current.gravity!, 1, 0);
    });
  });

  describe('storage failures', () => {
    it('still works for this page when storage refuses writes', async () => {
      stubAndroid();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      const { result } = mount(true);
      let ok = false;
      await act(async () => {
        ok = await result.current.enable();
      });
      expect(ok).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    it('treats unreadable storage as off', () => {
      stubAndroid();
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      expect(mount(true).result.current.enabled).toBe(false);
    });
  });
});
