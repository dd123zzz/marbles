import type { Marble, MarbleColor } from '../types';
import type { MarbleAnim } from './MarbleShape.tsx';

export const DROP_STAGGER_MS = 40;

const isLogged = (c: MarbleColor) => c === 'g' || c === 'b' || c === 'r';
const wasUnlogged = (c: MarbleColor) => c === 'unlogged' || c === 'sleep' || c === 'empty';

/**
 * Entrance animations for the marbles that changed between two renders of the same day:
 * a marble that gained a logged half drops in (staggered by hour); one that only moved
 * between logged categories pops. `extraDelayMs` postpones every animation, e.g. while a
 * dragged marble flies to the jar.
 */
export function diffAnims(
  prev: readonly Marble[],
  next: readonly Marble[],
  extraDelayMs = 0,
): Map<number, MarbleAnim> {
  const before = new Map(prev.map((m) => [m.hour, m]));
  const out = new Map<number, MarbleAnim>();
  let drops = 0;
  for (const m of [...next].sort((a, b) => a.hour - b.hour)) {
    const p = before.get(m.hour);
    if (!p) continue;
    const halves: [MarbleColor, MarbleColor][] = [
      [p.left, m.left],
      [p.right, m.right],
    ];
    if (halves.some(([a, b]) => wasUnlogged(a) && isLogged(b))) {
      out.set(m.hour, { kind: 'drop', delay: extraDelayMs + drops++ * DROP_STAGGER_MS });
    } else if (halves.some(([a, b]) => isLogged(a) && isLogged(b) && a !== b)) {
      out.set(m.hour, { kind: 'pop', delay: extraDelayMs });
    }
  }
  return out;
}
