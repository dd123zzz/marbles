import { JAR_HEIGHT, JAR_WIDTH, MARBLE_RADIUS } from '../../components/jarLayout';
import { mulberry32 } from './rng';
import type { World } from './world';

export interface SeedLayoutOptions {
  /** Marble radius. */
  r?: number;
  /** Horizontal centre of the pack. */
  cx?: number;
  /** Y of the floor the first row rests on. */
  floor?: number;
  /** Marbles in a wide row; narrow rows hold one fewer. */
  perRow?: number;
  /** Extra space between neighbours, so the pack starts loose. */
  gap?: number;
  /** Max random offset per axis. */
  jitter?: number;
}

/**
 * Deterministic loose hex pack in id order: the first ids sit at the bottom row, left to right,
 * then rows alternate between `perRow` and `perRow - 1` marbles going up.
 */
export function seedLayout(
  ids: readonly string[],
  seed: string,
  opts: SeedLayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const r = opts.r ?? MARBLE_RADIUS;
  const cx = opts.cx ?? JAR_WIDTH / 2;
  const floor = opts.floor ?? JAR_HEIGHT - 3;
  const perRow = opts.perRow ?? 5;
  const gap = opts.gap ?? 1.5;
  const jitter = opts.jitter ?? 0.5;
  const rand = mulberry32(seed);
  const pitch = 2 * r + gap;
  const rowH = pitch * Math.sqrt(3) * 0.5 + gap;

  const out = new Map<string, { x: number; y: number }>();
  let row = 0;
  let col = 0;
  for (const id of ids) {
    const count = row % 2 === 0 ? perRow : perRow - 1;
    const x = cx + (col - (count - 1) / 2) * pitch + (rand() * 2 - 1) * jitter;
    const y = floor - r - 1 - row * rowH + (rand() * 2 - 1) * jitter;
    out.set(id, { x, y });
    if (++col >= count) {
      col = 0;
      row++;
    }
  }
  return out;
}

/** Runs up to `steps` fixed substeps (stopping early once asleep). Returns the number run. */
export function presettle(world: World, steps: number): number {
  return world.stepFixed(steps);
}
