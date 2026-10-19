import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { Category } from '../types';

/** Movement under this many px is a tap, not a drag. */
export const TAP_SLOP_PX = 6;
export const FLY_MS = 180;
export const SPRING_MS = 150;
const DEFAULT_DIAMETER = 52;
const LIFT_SCALE = 1.1;
const LAND_SCALE = 0.55;
const DRAGGING_CLASS = 'marble-dragging';

export interface DropInfo {
  clientX: number;
  clientY: number;
  /** release velocity in px/s (0 for a keyboard activation) */
  vx: number;
  vy: number;
  source: 'pointer' | 'keyboard';
}

export interface DropResult {
  /** false springs the marble back home (e.g. nothing was written) */
  accepted: boolean;
  /**
   * Where the overlay flies to: a rect (it aims at the top centre), or 'none' when the
   * receiving jar animates the marble itself. Defaults to the drop target rect.
   */
  flyTo?: DOMRect | 'none' | null;
}

export interface MarbleDragOptions {
  /** false lets the marble be dragged but a release never drops */
  enabled: boolean;
  onDrop: (category: Category, info: DropInfo) => DropResult | void;
  onTap?: (category: Category) => void;
  /** the category the jar should glow for, or null; fires when a drag becomes valid or ends */
  onArmedChange?: (category: Category | null) => void;
  /** the jar's rect, measured at pointerdown and used as the fly-to target */
  getDropTargetRect?: () => DOMRect | null;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Session {
  category: Category;
  pointerId: number;
  startX: number;
  startY: number;
  homeX: number;
  homeY: number;
  radius: number;
  x: number;
  y: number;
  lifted: boolean;
  valid: boolean;
  ended: boolean;
  targetRect: DOMRect | null;
  samples: Array<{ t: number; x: number; y: number }>;
  raf: number;
  cleanup: () => void;
}

function transformFor(s: Session, scale: number): string {
  const x = s.homeX + (s.x - s.startX) - s.radius;
  const y = s.homeY + (s.y - s.startY) - s.radius;
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

const preventTouchScroll = (e: TouchEvent) => {
  if (e.cancelable) e.preventDefault();
};

/**
 * Pointer-driven drag of a marble out of the tray. React state only changes when a marble is
 * lifted or put down; the overlay follows the pointer through a ref in requestAnimationFrame.
 */
export function useMarbleDrag(options: MarbleDragOptions) {
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const [active, setActive] = useState<Category | null>(null);
  const overlayRef: RefObject<HTMLDivElement | null> = useRef(null);
  const session = useRef<Session | null>(null);

  const paint = useCallback(() => {
    const s = session.current;
    const el = overlayRef.current;
    if (s && el && s.lifted) el.style.transform = transformFor(s, LIFT_SCALE);
  }, []);

  useLayoutEffect(() => {
    if (active) paint();
  }, [active, paint]);

  const finish = useCallback(() => {
    const s = session.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    s.cleanup();
    session.current = null;
    setActive(null);
  }, []);

  const animateOverlay = useCallback((to: Keyframe, duration: number, done: () => void) => {
    const el = overlayRef.current;
    const s = session.current;
    if (!el || !s || typeof el.animate !== 'function' || prefersReducedMotion()) {
      done();
      return;
    }
    const from: Keyframe = { transform: transformFor(s, LIFT_SCALE), opacity: 1 };
    const anim = el.animate([from, to], { duration, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = done;
    anim.oncancel = done;
  }, []);

  const springBack = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.ended = true;
    optsRef.current.onArmedChange?.(null);
    if (!s.lifted) {
      finish();
      return;
    }
    cancelAnimationFrame(s.raf);
    const home: Keyframe = {
      transform: `translate3d(${s.homeX - s.radius}px, ${s.homeY - s.radius}px, 0) scale(1)`,
      opacity: 1,
    };
    animateOverlay(home, SPRING_MS, finish);
  }, [animateOverlay, finish]);

  const fly = useCallback(
    (flyTo: DropResult['flyTo'], fallback: DOMRect | null) => {
      const s = session.current;
      if (!s) return;
      const rect = flyTo === 'none' ? null : (flyTo ?? fallback);
      if (!rect) {
        finish();
        return;
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + Math.min(rect.height * 0.08, 40);
      const land: Keyframe = {
        transform: `translate3d(${cx - s.radius}px, ${cy - s.radius}px, 0) scale(${LAND_SCALE})`,
        opacity: 0,
      };
      animateOverlay(land, FLY_MS, finish);
    },
    [animateOverlay, finish],
  );

  const release = useCallback(
    (s: Session) => {
      s.ended = true;
      cancelAnimationFrame(s.raf);
      const o = optsRef.current;
      if (!s.lifted) {
        // a tap
        finish();
        o.onTap?.(s.category);
        return;
      }
      if (!s.valid || !o.enabled) {
        springBack();
        return;
      }
      const first = s.samples[0];
      const last = s.samples[s.samples.length - 1];
      const dt = first && last ? (last.t - first.t) / 1000 : 0;
      const result = o.onDrop(s.category, {
        clientX: s.x,
        clientY: s.y,
        vx: dt > 0 ? (last.x - first.x) / dt : 0,
        vy: dt > 0 ? (last.y - first.y) / dt : 0,
        source: 'pointer',
      });
      o.onArmedChange?.(null);
      navigator.vibrate?.(20);
      if (result && !result.accepted) springBack();
      else fly(result?.flyTo, s.targetRect);
    },
    [finish, fly, springBack],
  );

  const onPointerDown = (category: Category) => (e: ReactPointerEvent<HTMLElement>) => {
    if (session.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.isPrimary === false && e.pointerType) return;
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    const rect = target.getBoundingClientRect();
    const radius = rect.width / 2 || DEFAULT_DIAMETER / 2;

    const cancel = () => {
      if (session.current && !session.current.ended) springBack();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cancel();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    const onContextMenu = (ev: Event) => ev.preventDefault();
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('contextmenu', onContextMenu);
    document.documentElement.classList.add(DRAGGING_CLASS);

    session.current = {
      category,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      homeX: rect.left + rect.width / 2,
      homeY: rect.top + rect.height / 2,
      radius,
      x: e.clientX,
      y: e.clientY,
      lifted: false,
      valid: false,
      ended: false,
      targetRect: optsRef.current.getDropTargetRect?.() ?? null,
      samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
      raf: 0,
      cleanup: () => {
        document.removeEventListener('touchmove', preventTouchScroll);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('contextmenu', onContextMenu);
        document.documentElement.classList.remove(DRAGGING_CLASS);
      },
    };
  };

  const own = (e: ReactPointerEvent<HTMLElement>): Session | null => {
    const s = session.current;
    return s && !s.ended && s.pointerId === e.pointerId ? s : null;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = own(e);
    if (!s) return;
    s.x = e.clientX;
    s.y = e.clientY;
    s.samples.push({ t: performance.now(), x: s.x, y: s.y });
    if (s.samples.length > 4) s.samples.shift();
    const dist = Math.hypot(s.x - s.startX, s.y - s.startY);
    if (!s.lifted && dist >= TAP_SLOP_PX) {
      s.lifted = true;
      setActive(s.category);
    }
    if (!s.lifted) return;
    const valid = dist >= s.radius * 2;
    if (valid !== s.valid) {
      s.valid = valid;
      const o = optsRef.current;
      o.onArmedChange?.(valid && o.enabled ? s.category : null);
      if (valid && o.enabled) navigator.vibrate?.(10);
    }
    if (!s.raf) {
      s.raf = requestAnimationFrame(() => {
        s.raf = 0;
        paint();
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const s = own(e);
    if (!s) return;
    s.x = e.clientX;
    s.y = e.clientY;
    paint();
    release(s);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (own(e)) springBack();
  };

  const onLostPointerCapture = (e: ReactPointerEvent<HTMLElement>) => {
    if (own(e)) springBack();
  };

  /** A click with detail 0 comes from the keyboard or a screen reader: log straight away. */
  const onClick = (category: Category) => (e: ReactMouseEvent<HTMLElement>) => {
    if (e.detail !== 0) return;
    const o = optsRef.current;
    if (!o.enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    o.onDrop(category, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      vx: 0,
      vy: 0,
      source: 'keyboard',
    });
    navigator.vibrate?.(20);
  };

  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      cancelAnimationFrame(s.raf);
      s.cleanup();
      session.current = null;
    },
    [],
  );

  const bind = (category: Category) => ({
    onPointerDown: onPointerDown(category),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onClick: onClick(category),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  return { active, overlayRef, bind };
}
