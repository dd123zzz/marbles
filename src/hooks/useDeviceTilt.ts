import { useCallback, useEffect, useState } from 'react';

export const TILT_STORAGE_KEY = 'marbles-tilt';

/** Gravity in screen space: x points right, y points down the screen. */
export interface TiltGravity {
  x: number;
  y: number;
}

export interface DeviceTilt {
  /** The browser reports device orientation at all. */
  supported: boolean;
  /** iOS 13+: enabling needs `DeviceOrientationEvent.requestPermission()` from a tap. */
  needsPermission: boolean;
  /** Listening for orientation right now. */
  enabled: boolean;
  /** Null while not listening. */
  gravity: TiltGravity | null;
  /** Call from a user gesture. Resolves true when tilt is on. */
  enable: () => Promise<boolean>;
  disable: () => void;
}

const DEG = Math.PI / 180;
const MIN_INTERVAL_MS = 1000 / 30;
/** Chord length of a 1° arc on the unit circle. Smaller gravity changes are dropped. */
const MIN_CHANGE = Math.sin(1 * DEG);
/** Raw magnitude below which the phone counts as flat. */
const FLAT_RADIUS = 0.5;
/** Extra downward pull at zero tilt. It fades out by FLAT_RADIUS. */
const FLAT_BIAS = 0.5;
/** Weakest gravity, so a flat phone still drifts marbles down-screen. */
const MIN_STRENGTH = 0.25;

/**
 * Maps W3C `deviceorientation` angles (degrees) to gravity in screen space.
 *
 * 1. Natural portrait frame: x = sin(gamma), y = sin(beta). Upright (beta 90) gives (0, 1),
 *    upside down (beta -90) gives (0, -1), gamma tilts left or right.
 * 2. Rotate by `screenAngle` (`screen.orientation.angle`, counter-clockwise) so landscape works.
 * 3. Flat (raw magnitude below FLAT_RADIUS): add a downward bias that fades as the phone tilts.
 *    This keeps the direction down-screen when the phone lies flat.
 * 4. Direction = normalized result. Magnitude = raw magnitude clamped to [MIN_STRENGTH, 1],
 *    so an upright phone gives a unit vector and a flat one gives a weaker pull.
 */
export function tiltToGravity(beta: number, gamma: number, screenAngle: number): TiltGravity {
  const x = Math.sin(gamma * DEG);
  const y = Math.sin(beta * DEG);
  const a = screenAngle * DEG;
  const sx = x * Math.cos(a) - y * Math.sin(a);
  const sy = x * Math.sin(a) + y * Math.cos(a);
  const magnitude = Math.hypot(sx, sy);
  const bias = FLAT_BIAS * (1 - Math.min(1, magnitude / FLAT_RADIUS));
  const len = Math.hypot(sx, sy + bias);
  const dx = len > 0 ? sx / len : 0;
  const dy = len > 0 ? (sy + bias) / len : 1;
  const strength = Math.min(1, Math.max(MIN_STRENGTH, magnitude));
  return { x: dx * strength, y: dy * strength };
}

type OrientationWithPermission = { requestPermission?: () => Promise<string> };

function hasPermissionApi(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as OrientationWithPermission).requestPermission ===
      'function'
  );
}

/** True when the permission is granted, or when no prompt is needed. */
async function requestOrientationPermission(): Promise<boolean> {
  const api = DeviceOrientationEvent as unknown as OrientationWithPermission;
  if (typeof api.requestPermission !== 'function') return true;
  try {
    return (await api.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function readStoredOn(): boolean {
  try {
    return localStorage.getItem(TILT_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeStored(on: boolean): void {
  try {
    localStorage.setItem(TILT_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage refused: the choice still holds for this page session.
  }
}

function currentScreenAngle(): number {
  const angle =
    (screen as Screen & { orientation?: { angle?: number } }).orientation?.angle ??
    (window as Window & { orientation?: number }).orientation ??
    0;
  return ((angle % 360) + 360) % 360;
}

/** Desktop browsers expose DeviceOrientationEvent too, but only touch devices can be tilted. */
function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Device tilt as gravity for the Loose jar.
 *
 * `enabledPref` is the caller's gate: pass true only while tilt should run (for example, the
 * Loose jar is showing and reduced motion is off). The per-device on/off choice is stored in
 * localStorage under `marbles-tilt` (default off) and changed with `enable` and `disable`.
 * On iOS a stored "on" waits for a fresh `enable()` call, so `enabled` is false until then.
 */
export function useDeviceTilt(enabledPref: boolean): DeviceTilt {
  const supported = typeof DeviceOrientationEvent !== 'undefined' && hasCoarsePointer();
  const needsPermission = hasPermissionApi();
  const [on, setOn] = useState(readStoredOn);
  const [granted, setGranted] = useState(false);
  const [gravity, setGravity] = useState<TiltGravity | null>(null);

  const active = supported && enabledPref && on && (granted || !needsPermission);

  useEffect(() => {
    if (!active) return;
    let last: TiltGravity | null = null;
    let lastEmitAt = -Infinity;
    let pending: TiltGravity | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      const next = pending;
      pending = null;
      if (!next) return;
      lastEmitAt = Date.now();
      if (last && Math.hypot(next.x - last.x, next.y - last.y) < MIN_CHANGE) return;
      last = next;
      setGravity(next);
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      pending = tiltToGravity(e.beta, e.gamma, currentScreenAngle());
      // Leading edge emits at once. Later events collapse into one trailing update.
      const wait = lastEmitAt + MIN_INTERVAL_MS - Date.now();
      if (wait <= 0) flush();
      else if (timer === undefined) timer = setTimeout(flush, wait);
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      clearTimeout(timer);
      pending = null;
    };
  }, [active]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    if (needsPermission) {
      if (!(await requestOrientationPermission())) return false;
      setGranted(true);
    }
    writeStored(true);
    setOn(true);
    return true;
  }, [supported, needsPermission]);

  const disable = useCallback(() => {
    writeStored(false);
    setOn(false);
  }, []);

  return {
    supported,
    needsPermission,
    enabled: active,
    // Masked when inactive, so a stale value never leaks into the next session.
    gravity: active ? gravity : null,
    enable,
    disable,
  };
}
