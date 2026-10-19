import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { createWorld, presettle, seedLayout, type World } from '../lib/physics';
import type { DateKey, Marble } from '../types';
import { JAR_COLLIDERS, JAR_HEIGHT, JAR_WIDTH, MARBLE_RADIUS } from './jarLayout';
import { JarDefs, JarGlassFill, JarGlassOverlay } from './JarSvg.tsx';
import MarbleShape from './MarbleShape.tsx';
import './jar.css';
import './physicsJar.css';

export interface PhysicsJarHandle {
  /**
   * Re-spawns the hour's marble at a viewport point (clamped inside the glass) with a pointer
   * velocity in px/s. A point outside the jar spawns it at the neck instead.
   */
  dropAt(hour: number, clientX: number, clientY: number, vx: number, vy: number): void;
  /** Viewport rect of the jar svg, for converting pointer coordinates. */
  getRect(): DOMRect | null;
}

export interface PhysicsJarProps {
  marbles: Marble[];
  /** Same contract as `Jar`: slot = hour*2 (+1 for the :30–:60 half). */
  onSelect?: (slot: number, marble: Marble) => void;
  /** accessible name of the whole jar */
  label?: string;
  /** Day shown. Changing it rebuilds the world; it also seeds the initial layout. */
  date: DateKey;
  /** Overrides the `prefers-reduced-motion` media query. */
  reducedMotion?: boolean;
  /** Gravity direction in jar space (x right, y down), e.g. from device tilt. Default straight down. */
  gravity?: { x: number; y: number };
  ref?: Ref<PhysicsJarHandle>;
}

const PRESETTLE_STEPS = 120;
// Reduced motion has no live loop, so the layout is settled right away
const STATIC_SETTLE_STEPS = 400;
const HOP_SPEED = 180;
const DROP_GRACE_MS = 1500;
const R = MARBLE_RADIUS;

const LID = JAR_COLLIDERS[JAR_COLLIDERS.length - 1];
const LID_Y = LID.y1;
const NECK_MIN_X = Math.min(LID.x1, LID.x2);
const NECK_MAX_X = Math.max(LID.x1, LID.x2);
const FLOOR_Y = Math.max(...JAR_COLLIDERS.map((c) => Math.max(c.y1, c.y2)));
const SPAWN_Y = LID_Y + R + 2;
const SPAWN_STEP = 2 * R + 2;
// Spawn columns stay inside the neck, so a marble never starts beyond the glass
const SPAWN_SPAN = NECK_MAX_X - NECK_MIN_X - 2 * R;
const SPAWN_PER_ROW = Math.max(1, Math.floor(SPAWN_SPAN / SPAWN_STEP) + 1);
const SPAWN_MAX_Y = FLOOR_Y - R - 1;
const BOUNDS = {
  minX: Math.min(...JAR_COLLIDERS.flatMap((c) => [c.x1, c.x2])),
  maxX: Math.max(...JAR_COLLIDERS.flatMap((c) => [c.x1, c.x2])),
  minY: Math.min(...JAR_COLLIDERS.flatMap((c) => [c.y1, c.y2])),
  maxY: FLOOR_Y,
};

/** `count` points inside the neck: rows of marbles centred on the jar, wrapping downward. */
function spawnPoints(count: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / SPAWN_PER_ROW);
    const inRow = Math.min(SPAWN_PER_ROW, count - row * SPAWN_PER_ROW);
    const x = JAR_WIDTH / 2 + ((i % SPAWN_PER_ROW) - (inRow - 1) / 2) * SPAWN_STEP;
    pts.push({
      x: Math.min(Math.max(x, NECK_MIN_X + R), NECK_MAX_X - R),
      y: Math.min(SPAWN_Y + row * SPAWN_STEP, SPAWN_MAX_Y),
    });
  }
  return pts;
}

/** Safety net: a body whose centre is more than a radius outside the glass is put back at the neck. */
function rehomeEscaped(world: World): boolean {
  const lost: string[] = [];
  for (const [id, p] of world.positions()) {
    if (
      p.x < BOUNDS.minX - R ||
      p.x > BOUNDS.maxX + R ||
      p.y < BOUNDS.minY - R ||
      p.y > BOUNDS.maxY + R ||
      !Number.isFinite(p.x + p.y)
    ) {
      lost.push(id);
    }
  }
  const pts = spawnPoints(lost.length);
  lost.forEach((id, i) => world.add(id, { x: pts[i].x, y: pts[i].y, r: R }));
  return lost.length > 0;
}

/** Settles a world with no live loop, re-homing anything that escapes. */
function settleStatic(world: World, steps: number): void {
  for (let pass = 0; pass < 3; pass++) {
    world.stepFixed(steps);
    if (!rehomeEscaped(world)) return;
  }
}

/** Every hour that has started, gray ones too; future hours and DST gaps are absent. */
function isStarted(m: Marble): boolean {
  return m.left !== 'na' && m.right !== 'na' && (m.left !== 'empty' || m.right !== 'empty');
}

const colorKey = (m: Marble) => `${m.left}|${m.right}`;

function createController(world: World) {
  const els = new Map<number, SVGGElement>();
  let raf: number | null = null;
  let last = 0;
  let live = true;

  const canRun = () => live && !document.hidden && !world.isAsleep();

  function apply() {
    const pos = world.positions();
    for (const [hour, el] of els) {
      const p = pos.get(String(hour));
      if (p) el.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
    }
  }

  function frame() {
    raf = null;
    const now = performance.now();
    world.step((now - last) / 1000);
    rehomeEscaped(world);
    last = now;
    apply();
    if (canRun()) raf = requestAnimationFrame(frame);
  }

  return {
    setEl(hour: number, el: SVGGElement | null) {
      if (el) els.set(hour, el);
      else els.delete(hour);
    },
    apply,
    /** Starts the loop if there is something to animate. No-op while running. */
    start() {
      if (raf !== null || !canRun()) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    },
    setLive(next: boolean) {
      live = next;
      if (!next) this.stop();
    },
  };
}

function buildWorld(date: DateKey, hours: readonly number[], steps: number): World {
  const world = createWorld({ segments: JAR_COLLIDERS });
  const layout = seedLayout(hours.map(String), date);
  for (const hour of hours) {
    const p = layout.get(String(hour));
    if (p) world.add(String(hour), { x: p.x, y: p.y, r: R });
  }
  presettle(world, steps);
  return world;
}

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

interface Placement {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * The "Loose" day jar: the marbles of every hour that has started roll and settle in the jar.
 * Positions are written straight to the DOM from a rAF loop that runs only while the world is awake.
 */
export default function PhysicsJar(props: PhysicsJarProps) {
  // A different day starts a fresh world
  return <PhysicsJarDay key={props.date} {...props} />;
}

function PhysicsJarDay({
  marbles,
  onSelect,
  label = 'Day jar',
  date,
  reducedMotion,
  gravity,
  ref,
}: PhysicsJarProps) {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const gradId = `jar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const started = useMemo(() => marbles.filter(isStarted), [marbles]);

  const [world] = useState(() =>
    buildWorld(
      date,
      started.map((m) => m.hour),
      reduced ? PRESETTLE_STEPS + STATIC_SETTLE_STEPS : PRESETTLE_STEPS,
    ),
  );
  const [ctrl] = useState(() => createController(world));

  const prevColors = useRef<Map<number, string>>(null);
  const dropped = useRef(new Map<number, number>());
  const pending = useRef(new Map<number, Placement & { at: number }>());

  useLayoutEffect(() => {
    ctrl.setLive(!reduced);
  }, [ctrl, reduced]);

  // Reconcile the world with the marbles: spawn new hours, drop gone ones, hop recoloured ones.
  useLayoutEffect(() => {
    const now = performance.now();
    const hours = new Set(started.map((m) => m.hour));
    for (const id of [...world.positions().keys()]) {
      if (!hours.has(Number(id))) world.remove(id);
    }
    const fresh = started
      .filter((m) => !world.has(String(m.hour)))
      .map((m) => {
        const p = pending.current.get(m.hour);
        pending.current.delete(m.hour);
        return { hour: m.hour, placed: p && now - p.at < DROP_GRACE_MS ? p : null };
      });
    const spawns = spawnPoints(fresh.filter((f) => !f.placed).length);
    let next = 0;
    fresh.forEach(({ hour, placed }) => {
      const at = placed ?? spawns[next++];
      world.add(String(hour), {
        x: at.x,
        y: at.y,
        vx: placed?.vx,
        vy: placed?.vy,
        r: R,
      });
    });

    const colors = new Map(started.map((m) => [m.hour, colorKey(m)]));
    const before = prevColors.current;
    if (before && !reduced) {
      for (const m of started) {
        const was = before.get(m.hour);
        const dropTime = dropped.current.get(m.hour);
        const justDropped = dropTime !== undefined && now - dropTime < DROP_GRACE_MS;
        if (was !== undefined && was !== colors.get(m.hour) && !justDropped) {
          world.impulse(String(m.hour), 0, -HOP_SPEED);
        }
      }
    }
    prevColors.current = colors;

    if (reduced) settleStatic(world, STATIC_SETTLE_STEPS);
    ctrl.apply();
    ctrl.start();
  }, [world, ctrl, started, reduced]);

  const gx = gravity?.x ?? 0;
  const gy = gravity?.y ?? 1;
  useEffect(() => {
    if (reduced) return;
    world.setGravity(gx, gy);
    ctrl.start();
  }, [world, ctrl, reduced, gx, gy]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) ctrl.stop();
      else ctrl.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    ctrl.start();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      ctrl.stop();
    };
  }, [ctrl]);

  useImperativeHandle(
    ref,
    () => ({
      getRect: () => svgRef.current?.getBoundingClientRect() ?? null,
      dropAt(hour, clientX, clientY, vx, vy) {
        const rect = svgRef.current?.getBoundingClientRect();
        const inside =
          !!rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom;
        let place: Placement = { x: JAR_WIDTH / 2, y: SPAWN_Y, vx: 0, vy: 0 };
        if (inside) {
          const sx = JAR_WIDTH / rect.width;
          const sy = JAR_HEIGHT / rect.height;
          place = {
            x: Math.min(Math.max((clientX - rect.left) * sx, NECK_MIN_X + R), NECK_MAX_X - R),
            y: Math.min(Math.max((clientY - rect.top) * sy, SPAWN_Y), FLOOR_Y - R - 1),
            vx: reduced ? 0 : vx * sx,
            vy: reduced ? 0 : vy * sy,
          };
        }
        const now = performance.now();
        dropped.current.set(hour, now);
        const id = String(hour);
        if (!world.has(id)) {
          // The marble may not be rendered yet: it spawns here when it appears.
          pending.current.set(hour, { ...place, at: now });
          return;
        }
        world.remove(id);
        world.add(id, { x: place.x, y: place.y, vx: place.vx, vy: place.vy, r: R });
        if (reduced) settleStatic(world, STATIC_SETTLE_STEPS);
        ctrl.apply();
        ctrl.start();
      },
    }),
    [world, ctrl, reduced],
  );

  return (
    <div className="jar physics-jar">
      <svg
        ref={svgRef}
        className="jar-svg"
        viewBox={`0 0 ${JAR_WIDTH} ${JAR_HEIGHT}`}
        width="100%"
        role={onSelect ? 'group' : 'img'}
        aria-label={label}
      >
        <JarDefs gradId={gradId} />
        <JarGlassFill gradId={gradId} />
        {started.map((marble) => (
          <g
            key={marble.hour}
            className="physics-marble"
            data-hour={marble.hour}
            ref={(el) => {
              ctrl.setEl(marble.hour, el);
            }}
          >
            <MarbleShape
              marble={marble}
              cx={0}
              cy={0}
              r={R}
              gradId={gradId}
              showHour
              onSelect={onSelect}
            />
          </g>
        ))}
        <JarGlassOverlay />
      </svg>
    </div>
  );
}
