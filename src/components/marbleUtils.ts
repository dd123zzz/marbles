import { CATEGORY_LABEL } from '../lib/jar';
import { slotToHHmm } from '../lib/time';
import type { Marble, MarbleColor } from '../types';

/** Colors that are drawn as glossy glass marbles; the rest are matte or outlined. */
export const GLOSSY = ['p', 'g', 'b', 'r', 'sleep'] as const;
export const GRADIENT_COLORS = [...GLOSSY, 'unlogged'] as const;

export function isGlossy(c: MarbleColor): boolean {
  return (GLOSSY as readonly string[]).includes(c);
}

export function halfLabel(marble: Marble, half: 0 | 1): string {
  const slot = marble.hour * 2 + half;
  const color = half === 0 ? marble.left : marble.right;
  return `${slotToHHmm(slot)}–${slotToHHmm(slot + 1)} ${CATEGORY_LABEL[color]}`;
}
