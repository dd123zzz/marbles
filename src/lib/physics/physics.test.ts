import { describe, expect, it } from 'vitest';
import { JAR_COLLIDERS, JAR_HEIGHT, JAR_WIDTH, MARBLE_RADIUS } from '../../components/jarLayout';
import { createWorld, mulberry32, presettle, seedLayout, type World } from './index';

const R = MARBLE_RADIUS;
const HOURS = Array.from({ length: 24 }, (_, i) => `h${String(i).padStart(2, '0')}`);

function makeJar(ids: readonly string[] = HOURS, seed = '2026-10-18'): World {
  const world = createWorld({ segments: JAR_COLLIDERS });
  for (const [id, p] of seedLayout(ids, seed)) world.add(id, { ...p, r: R });
  return world;
}

function insidePolygon(x: number, y: number): boolean {
  let inside = false;
  for (const s of JAR_COLLIDERS) {
    if (s.y1 > y !== s.y2 > y && x < s.x1 + ((y - s.y1) / (s.y2 - s.y1)) * (s.x2 - s.x1)) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegments(x: number, y: number): number {
  let best = Infinity;
  for (const s of JAR_COLLIDERS) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - s.x1 - t * dx, y - s.y1 - t * dy));
  }
  return best;
}

function expectContained(world: World, tol = 0.5): void {
  for (const [id, p] of world.positions()) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${id} finite`).toBe(true);
    expect(insidePolygon(p.x, p.y), `${id} inside glass`).toBe(true);
    expect(distToSegments(p.x, p.y), `${id} wall penetration`).toBeGreaterThanOrEqual(R - tol);
  }
}

function maxOverlap(world: World): number {
  const ps = [...world.positions().values()];
  let worst = 0;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      worst = Math.max(worst, 2 * R - Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y));
    }
  }
  return worst;
}

function runUntilAsleep(world: World, maxSteps: number): number {
  let n = 0;
  while (!world.isAsleep() && n < maxSteps) n += world.stepFixed(10);
  return n;
}

describe('JAR_COLLIDERS', () => {
  it('forms a closed loop inside the viewBox with the interior on the normal side', () => {
    const n = JAR_COLLIDERS.length;
    expect(n).toBeGreaterThanOrEqual(30);
    JAR_COLLIDERS.forEach((s, k) => {
      const next = JAR_COLLIDERS[(k + 1) % n];
      expect(next.x1).toBeCloseTo(s.x2, 9);
      expect(next.y1).toBeCloseTo(s.y2, 9);
      expect(s.x1).toBeGreaterThan(0);
      expect(s.x1).toBeLessThan(JAR_WIDTH);
      expect(s.y1).toBeGreaterThan(0);
      expect(s.y1).toBeLessThan(JAR_HEIGHT);
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      const mx = (s.x1 + s.x2) / 2 + ((s.y2 - s.y1) / len) * 0.5;
      const my = (s.y1 + s.y2) / 2 - ((s.x2 - s.x1) / len) * 0.5;
      expect(insidePolygon(mx, my)).toBe(true);
    });
  });

  it('is inset by half the stroke from the glass walls and floor', () => {
    const xs = JAR_COLLIDERS.flatMap((s) => [s.x1, s.x2]);
    const ys = JAR_COLLIDERS.flatMap((s) => [s.y1, s.y2]);
    expect(Math.min(...xs)).toBeCloseTo(3 + 1.25, 6);
    expect(Math.max(...xs)).toBeCloseTo(JAR_WIDTH - 3 - 1.25, 6);
    expect(Math.max(...ys)).toBeCloseTo(JAR_HEIGHT - 3 - 1.25, 6);
  });
});

describe('seedLayout / mulberry32', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = mulberry32('2026-10-18');
    const b = mulberry32('2026-10-18');
    const seq = [a(), a(), a()];
    expect(seq).toEqual([b(), b(), b()]);
    for (const v of seq) expect(v).toBeGreaterThanOrEqual(0);
    expect(mulberry32('2026-10-19')()).not.toBe(seq[0]);
  });

  it('packs lower ids at the bottom, without overlapping the glass', () => {
    const layout = seedLayout(HOURS, 'x');
    expect(layout.size).toBe(24);
    expect(layout.get('h00')!.y).toBeGreaterThan(layout.get('h23')!.y);
    expect(layout.get('h00')!.y).toBeGreaterThan(layout.get('h06')!.y);
    for (const p of layout.values()) expect(insidePolygon(p.x, p.y)).toBe(true);
  });
});

describe('world: settling', () => {
  it('24 marbles settle inside the glass and fall asleep', () => {
    const world = makeJar();
    const steps = runUntilAsleep(world, 1200);
    expect(world.isAsleep()).toBe(true);
    expect(steps).toBeLessThan(1200);
    expectContained(world);
    expect(maxOverlap(world)).toBeLessThan(1.5);
  });

  it('stays in order roughly bottom = early and fills about the lower half', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    const pos = world.positions();
    const mean = (ids: string[]) => ids.reduce((s, id) => s + pos.get(id)!.y, 0) / ids.length;
    expect(mean(HOURS.slice(0, 8))).toBeGreaterThan(mean(HOURS.slice(16)));
    const top = Math.min(...[...pos.values()].map((p) => p.y));
    expect(top).toBeGreaterThan(JAR_HEIGHT * 0.4);
  });

  it('a marble spawned at the neck falls, lands on the pile and the world sleeps again within 3 s', () => {
    const world = makeJar(HOURS.slice(0, 23));
    runUntilAsleep(world, 1200);
    expect(world.isAsleep()).toBe(true);
    world.add('h23', { x: JAR_WIDTH / 2, y: 40, r: R });
    expect(world.isAsleep()).toBe(false);
    const steps = runUntilAsleep(world, 1200);
    expect(steps).toBeLessThan(360);
    expectContained(world);
  });

  it('is deterministic: same seed gives identical positions', () => {
    const run = (seed: string) => {
      const w = makeJar(HOURS, seed);
      presettle(w, 120);
      w.step(1 / 60);
      return [...w.positions()];
    };
    expect(run('2026-10-18')).toEqual(run('2026-10-18'));
    expect(run('2026-10-18')).not.toEqual(run('2026-10-19'));
  });

  it('energy decreases over time', () => {
    const world = makeJar();
    // Raise the pack well above the floor so there is potential energy to lose.
    for (const [id, p] of world.positions()) world.add(id, { x: p.x, y: p.y - 60, r: R });
    // Measured above the floor so the numbers stay small.
    const base = 24 * R * R * 1400 * JAR_HEIGHT;
    const samples: number[] = [world.energy() + base];

    for (let i = 0; i < 20; i++) {
      world.stepFixed(30);
      samples.push(world.energy() + base);
    }
    const drop = samples[0] - samples[samples.length - 1];
    expect(drop).toBeGreaterThan(0);
    // Contact corrections may add a hair of energy between samples, never a meaningful amount.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-4 * samples[0]);
    }
  });

  it('a woken settled pile stays put: no hovering sleepers, no drift', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    const before = world.positions();
    world.wake();
    world.stepFixed(240);
    for (const [id, p] of world.positions()) {
      expect(Math.hypot(p.x - before.get(id)!.x, p.y - before.get(id)!.y), id).toBeLessThan(1);
    }
  });

  it('does not jitter once settled: positions stop changing', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    const before = [...world.positions()];
    world.step(1);
    expect([...world.positions()]).toEqual(before);
  });
});

describe('world: containment under abuse', () => {
  it('rotating gravity 180° (upside-down jar) never ejects marbles', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    for (let deg = 0; deg <= 180; deg += 5) {
      const a = (deg * Math.PI) / 180;
      world.setGravity(Math.sin(a), Math.cos(a));
      world.stepFixed(15);
      expectContained(world, 1);
    }
    world.stepFixed(600);
    expectContained(world);
    world.setGravity(0, 1);
    world.stepFixed(1200);
    expectContained(world);
  });

  it('a sudden flip of gravity keeps everything inside', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    world.setGravity(0, -1);
    runUntilAsleep(world, 1200);
    expectContained(world);
    world.setGravity(0, 1);
    runUntilAsleep(world, 1200);
    expectContained(world);
  });

  it('100 random impulses do not eject anything', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    const rand = mulberry32('impulses');
    for (let i = 0; i < 100; i++) {
      const id = HOURS[Math.floor(rand() * HOURS.length)];
      const a = rand() * Math.PI * 2;
      const mag = 200 + rand() * 2500;
      world.impulse(id, Math.cos(a) * mag, Math.sin(a) * mag);
      world.stepFixed(1 + Math.floor(rand() * 40));
      expectContained(world, 1.5);
    }
    runUntilAsleep(world, 2400);
    expect(world.isAsleep()).toBe(true);
    expectContained(world);
  });
});

describe('world: add / remove / wake semantics', () => {
  it('add, has, remove and positions', () => {
    const world = createWorld({ segments: JAR_COLLIDERS });
    expect(world.isAsleep()).toBe(true);
    world.add('a', { x: 94, y: 100, r: R });
    expect(world.has('a')).toBe(true);
    expect(world.has('b')).toBe(false);
    expect(world.isAsleep()).toBe(false);
    expect(world.positions().get('a')).toEqual({ x: 94, y: 100 });
    world.remove('a');
    expect(world.has('a')).toBe(false);
    expect(world.positions().size).toBe(0);
    expect(world.isAsleep()).toBe(true);
    expect(() => world.remove('missing')).not.toThrow();
    expect(() => world.impulse('missing', 1, 1)).not.toThrow();
  });

  it('remove wakes the world and lets the pile settle again', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    world.remove('h02');
    expect(world.has('h02')).toBe(false);
    expect(world.isAsleep()).toBe(false);
    runUntilAsleep(world, 1200);
    expect(world.isAsleep()).toBe(true);
    expectContained(world);
  });

  it('wake, impulse and big gravity changes wake a sleeping world; step does nothing while asleep', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    const before = [...world.positions()];
    world.step(0.5);
    expect([...world.positions()]).toEqual(before);

    world.wake();
    expect(world.isAsleep()).toBe(false);
    runUntilAsleep(world, 1200);

    world.impulse('h23', 300, -300);
    expect(world.isAsleep()).toBe(false);
    runUntilAsleep(world, 1200);

    world.setGravity(0, 1);
    expect(world.isAsleep()).toBe(true);
    world.setGravity(Math.sin(0.02), Math.cos(0.02));
    expect(world.isAsleep()).toBe(true);
    world.setGravity(Math.sin(0.2), Math.cos(0.2));
    expect(world.isAsleep()).toBe(false);
  });

  it('small gravity changes accumulate until they exceed ~3°', () => {
    const world = makeJar();
    runUntilAsleep(world, 1200);
    let woke = false;
    for (let deg = 1; deg <= 6; deg++) {
      const a = (deg * Math.PI) / 180;
      world.setGravity(Math.sin(a), Math.cos(a));
      if (!world.isAsleep()) {
        woke = true;
        expect(deg).toBeGreaterThanOrEqual(3);
        break;
      }
    }
    expect(woke).toBe(true);
  });

  it('step uses at most 4 fixed substeps per call and clamps huge dt', () => {
    const world = createWorld({ segments: JAR_COLLIDERS });
    world.add('a', { x: 94, y: 40, r: R });
    world.step(10);
    const fall = world.positions().get('a')!.y - 40;
    // 4 substeps of 1/120 s under g = 1400: about 0.5 * g * (4/120)² + a little more.
    expect(fall).toBeGreaterThan(0.5);
    expect(fall).toBeLessThan(5);
  });

  it('does not tunnel through the floor at max speed', () => {
    const world = createWorld({ segments: JAR_COLLIDERS });
    world.add('a', { x: 94, y: 60, vy: 5000, r: R });
    world.stepFixed(600);
    expectContained(world);
  });
});

describe('performance (soft)', () => {
  it('24 bodies presettle in 120 steps quickly', () => {
    const world = makeJar();
    const t0 = performance.now();
    presettle(world, 120);
    const ms = performance.now() - t0;
    console.log(`presettle 24 bodies x 120 steps: ${ms.toFixed(2)} ms`);
    // Target is < 20 ms on a mid-range phone; the bound here only catches blow-ups.
    expect(ms).toBeLessThan(250);
    expectContained(world, 1);
  });
});
