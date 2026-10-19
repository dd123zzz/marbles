export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BodyInit {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  r: number;
}

export interface WorldOptions {
  /** Static polyline. Edge (dx, dy) has its free side along the normal (dy, -dx). */
  segments: readonly Segment[];
  /** Gravity magnitude in units/s². */
  g?: number;
  /** Initial gravity direction (normalised internally). Default straight down (0, 1). */
  gx?: number;
  gy?: number;
  restitution?: number;
  friction?: number;
  /** Linear damping, 1/s. */
  damping?: number;
  /** Units/s. */
  maxSpeed?: number;
  iterations?: number;
  /** Fixed substep, seconds. */
  substep?: number;
  maxSubsteps?: number;
  /** Speed below which a body counts as calm, units/s. */
  sleepSpeed?: number;
  /** Consecutive calm substeps before a body sleeps. */
  sleepFrames?: number;
}

export interface World {
  add(id: string, body: BodyInit): void;
  remove(id: string): void;
  has(id: string): boolean;
  size(): number;
  /** Advances by dt seconds using fixed substeps (at most `maxSubsteps` per call). */
  step(dt: number): void;
  /** Runs exactly `n` fixed substeps (stops early when asleep). Returns the number run. */
  stepFixed(n: number): number;
  positions(): Map<string, { x: number; y: number }>;
  isAsleep(): boolean;
  wake(): void;
  /** Direction is normalised and scaled by g; wakes the world when it turns by more than ~3°. */
  setGravity(gx: number, gy: number): void;
  /** Adds a velocity change to one body and wakes it. */
  impulse(id: string, vx: number, vy: number): void;
  /** Kinetic + potential energy (mass = r²), for diagnostics and tests. */
  energy(): number;
}

interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  px: number;
  py: number;
  asleep: boolean;
  calm: number;
  ok: boolean;
}

interface Contact {
  a: Body;
  b: Body | null;
  nx: number;
  ny: number;
  vn: number;
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  len: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const WAKE_ANGLE_COS = Math.cos((3 * Math.PI) / 180);
const MAX_FRAME_DT = 0.05;

export function createWorld(opts: WorldOptions): World {
  const g = opts.g ?? 1400;
  const restitution = opts.restitution ?? 0.2;
  const mu = opts.friction ?? 0.1;
  const damping = opts.damping ?? 0.4;
  const maxSpeed = opts.maxSpeed ?? 1000;
  const iterations = opts.iterations ?? 8;
  const h = opts.substep ?? 1 / 120;
  const maxSubsteps = opts.maxSubsteps ?? 4;
  const sleepSpeed = opts.sleepSpeed ?? 6;
  const sleepFrames = opts.sleepFrames ?? 30;
  // Impacts slower than this don't bounce (resting contacts see about g*h each substep).
  const bounceSpeed = 6 * g * h;
  const wakeSpeed = 3 * g * h;

  const segs: Seg[] = opts.segments.map((s) => {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    return {
      ax: s.x1,
      ay: s.y1,
      bx: s.x2,
      by: s.y2,
      ux: dx / len,
      uy: dy / len,
      nx: dy / len,
      ny: -dx / len,
      len,
      minX: Math.min(s.x1, s.x2),
      maxX: Math.max(s.x1, s.x2),
      minY: Math.min(s.y1, s.y2),
      maxY: Math.max(s.y1, s.y2),
    };
  });

  let gdx = 0;
  let gdy = 1;
  {
    const l = Math.hypot(opts.gx ?? 0, opts.gy ?? 1);
    if (l > 1e-9) {
      gdx = (opts.gx ?? 0) / l;
      gdy = (opts.gy ?? 1) / l;
    }
  }

  // Direction at the last wake: small tilt changes accumulate until they add up to ~3°.
  let wakeDx = gdx;
  let wakeDy = gdy;

  const bodies: Body[] = [];
  const byId = new Map<string, Body>();
  const contacts: Contact[] = [];
  let acc = 0;

  function wakeBody(b: Body): void {
    b.asleep = false;
    b.calm = 0;
  }

  function wake(): void {
    for (const b of bodies) wakeBody(b);
    acc = 0;
  }

  function solvePair(a: Body, b: Body, first: boolean): void {
    const dx = a.px - b.px;
    const dy = a.py - b.py;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2);
    const nx = d > 1e-9 ? dx / d : 1;
    const ny = d > 1e-9 ? dy / d : 0;
    if (first) {
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn < -wakeSpeed) {
        if (a.asleep) wakeBody(a);
        if (b.asleep) wakeBody(b);
      }
      contacts.push({ a, b, nx, ny, vn });
    }
    const wa = a.asleep ? 0 : a.w;
    const wb = b.asleep ? 0 : b.w;
    const ws = wa + wb;
    if (ws === 0) return;
    const pen = rr - d;
    a.px += (nx * pen * wa) / ws;
    a.py += (ny * pen * wa) / ws;
    b.px -= (nx * pen * wb) / ws;
    b.py -= (ny * pen * wb) / ws;
    // Position-based Coulomb friction: cancel relative sliding up to mu * penetration.
    const rx = a.px - a.x - (b.px - b.x);
    const ry = a.py - a.y - (b.py - b.y);
    const tx = rx - (rx * nx + ry * ny) * nx;
    const ty = ry - (rx * nx + ry * ny) * ny;
    const tl = Math.hypot(tx, ty);
    if (tl > 1e-12) {
      const k = Math.min(1, (mu * pen) / tl);
      a.px -= (tx * k * wa) / ws;
      a.py -= (ty * k * wa) / ws;
      b.px += (tx * k * wb) / ws;
      b.py += (ty * k * wb) / ws;
    }
  }

  function solveSegment(b: Body, s: Seg, first: boolean): void {
    const r = b.r;
    if (b.px < s.minX - r || b.px > s.maxX + r || b.py < s.minY - r || b.py > s.maxY + r) return;
    const ox = b.px - s.ax;
    const oy = b.py - s.ay;
    const along = ox * s.ux + oy * s.uy;
    let nx: number;
    let ny: number;
    let pen: number;
    if (along >= 0 && along <= s.len) {
      const dist = ox * s.nx + oy * s.ny;
      // A centre already behind the wall (but within one radius) is pushed back through it.
      if (dist >= r || dist < -r) return;
      nx = s.nx;
      ny = s.ny;
      pen = r - dist;
    } else {
      const ex = along < 0 ? s.ax : s.bx;
      const ey = along < 0 ? s.ay : s.by;
      const dx = b.px - ex;
      const dy = b.py - ey;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      const d = Math.sqrt(d2);
      if (d > 1e-9) {
        nx = dx / d;
        ny = dy / d;
      } else {
        nx = s.nx;
        ny = s.ny;
      }
      pen = r - d;
    }
    if (first) contacts.push({ a: b, b: null, nx, ny, vn: b.vx * nx + b.vy * ny });
    b.px += nx * pen;
    b.py += ny * pen;
    const rx = b.px - b.x;
    const ry = b.py - b.y;
    const dot = rx * nx + ry * ny;
    const tx = rx - dot * nx;
    const ty = ry - dot * ny;
    const tl = Math.hypot(tx, ty);
    if (tl > 1e-12) {
      const k = Math.min(1, (mu * pen) / tl);
      b.px -= tx * k;
      b.py -= ty * k;
    }
  }

  function substep(): void {
    const ax = gdx * g * h;
    const ay = gdy * g * h;
    const damp = Math.max(0, 1 - damping * h);
    for (const b of bodies) {
      if (b.asleep) {
        b.px = b.x;
        b.py = b.y;
        continue;
      }
      b.vx = (b.vx + ax) * damp;
      b.vy = (b.vy + ay) * damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > maxSpeed) {
        b.vx *= maxSpeed / sp;
        b.vy *= maxSpeed / sp;
      }
      b.px = b.x + b.vx * h;
      b.py = b.y + b.vy * h;
    }

    contacts.length = 0;
    const n = bodies.length;
    for (let it = 0; it < iterations; it++) {
      const first = it === 0;
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          if (a.asleep && b.asleep) continue;
          solvePair(a, b, first);
        }
      }
      for (const b of bodies) {
        if (b.asleep) continue;
        for (const s of segs) solveSegment(b, s, first);
      }
    }

    for (const b of bodies) {
      if (b.asleep) continue;
      b.vx = (b.px - b.x) / h;
      b.vy = (b.py - b.y) / h;
      b.x = b.px;
      b.y = b.py;
    }

    // Restitution: contacts that arrived fast get a fraction of the impact speed back.
    for (const c of contacts) {
      if (c.vn >= -bounceSpeed) continue;
      const { a, b } = c;
      const wa = a.asleep ? 0 : a.w;
      const wb = b && !b.asleep ? b.w : 0;
      const ws = wa + wb;
      if (ws === 0) continue;
      const cur = b ? (a.vx - b.vx) * c.nx + (a.vy - b.vy) * c.ny : a.vx * c.nx + a.vy * c.ny;
      const dv = -restitution * c.vn - cur;
      if (dv <= 0) continue;
      a.vx += (c.nx * dv * wa) / ws;
      a.vy += (c.ny * dv * wa) / ws;
      if (b && wb > 0) {
        b.vx -= (c.nx * dv * wb) / ws;
        b.vy -= (c.ny * dv * wb) / ws;
      }
    }

    // Sleep: a body qualifies after enough calm substeps, but touching bodies sleep together
    // so nothing is left hovering on a body that is still moving.
    const eps2 = sleepSpeed * sleepSpeed;
    for (const b of bodies) {
      if (b.asleep) continue;
      b.calm = b.vx * b.vx + b.vy * b.vy < eps2 ? b.calm + 1 : 0;
      b.ok = b.calm >= sleepFrames;
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const { a, b } of contacts) {
        if (!b || a.asleep || b.asleep || a.ok === b.ok) continue;
        a.ok = false;
        b.ok = false;
        changed = true;
      }
    }
    for (const b of bodies) {
      if (!b.asleep && b.ok) {
        b.asleep = true;
        b.vx = 0;
        b.vy = 0;
      }
    }
  }

  function isAsleep(): boolean {
    for (const b of bodies) if (!b.asleep) return false;
    return true;
  }

  return {
    add(id, init) {
      const existing = byId.get(id);
      const b: Body = existing ?? {
        id,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: init.r,
        w: 1,
        px: 0,
        py: 0,
        asleep: false,
        calm: 0,
        ok: false,
      };
      b.x = b.px = init.x;
      b.y = b.py = init.y;
      b.vx = init.vx ?? 0;
      b.vy = init.vy ?? 0;
      b.r = init.r;
      b.w = 1 / (init.r * init.r);
      wakeBody(b);
      if (!existing) {
        bodies.push(b);
        byId.set(id, b);
      }
    },
    remove(id) {
      const b = byId.get(id);
      if (!b) return;
      byId.delete(id);
      bodies.splice(bodies.indexOf(b), 1);
      // Whatever rested on it must be free to fall.
      wake();
    },
    has: (id) => byId.has(id),
    size: () => bodies.length,
    step(dt) {
      if (!(dt > 0) || isAsleep()) return;
      acc += Math.min(dt, MAX_FRAME_DT);
      let n = 0;
      while (acc >= h - 1e-9 && n < maxSubsteps) {
        substep();
        acc -= h;
        n++;
        if (isAsleep()) {
          acc = 0;
          return;
        }
      }
      if (acc > h) acc = h;
    },
    stepFixed(n) {
      let done = 0;
      while (done < n && !isAsleep()) {
        substep();
        done++;
      }
      return done;
    },
    positions() {
      const m = new Map<string, { x: number; y: number }>();
      for (const b of bodies) m.set(b.id, { x: b.x, y: b.y });
      return m;
    },
    isAsleep,
    wake,
    setGravity(gx, gy) {
      const l = Math.hypot(gx, gy);
      if (l < 1e-9) return;
      gdx = gx / l;
      gdy = gy / l;
      if (gdx * wakeDx + gdy * wakeDy < WAKE_ANGLE_COS) {
        wakeDx = gdx;
        wakeDy = gdy;
        wake();
      }
    },
    impulse(id, vx, vy) {
      const b = byId.get(id);
      if (!b) return;
      b.vx += vx;
      b.vy += vy;
      wakeBody(b);
    },
    energy() {
      let e = 0;
      for (const b of bodies) {
        const m = b.r * b.r;
        e += 0.5 * m * (b.vx * b.vx + b.vy * b.vy) - m * g * (gdx * b.x + gdy * b.y);
      }
      return e;
    },
  };
}
