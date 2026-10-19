import { useState } from 'react';
import type { DateKey, Marble } from '../types';
import JarSvg from './JarSvg.tsx';
import { diffAnims } from './jarAnim';
import type { MarbleAnim } from './MarbleShape.tsx';

interface JarProps {
  marbles: Marble[];
  onSelect?: (slot: number, marble: Marble) => void;
  /** accessible name of the whole jar */
  label?: string;
  /** day shown; changing it (or the label, if omitted) resets animations */
  date?: DateKey;
  /** postpones the entrance animations of marbles that change, e.g. until a dragged marble lands */
  dropDelayMs?: number;
}

interface Tracked {
  key: string;
  marbles: Marble[];
  anims: ReadonlyMap<number, MarbleAnim>;
}

export default function Jar({
  marbles,
  onSelect,
  label = 'Day jar',
  date,
  dropDelayMs = 0,
}: JarProps) {
  const key = date ?? label;
  const [tracked, setTracked] = useState<Tracked>({ key, marbles, anims: new Map() });

  // Derived during render: a different day starts fresh, the same day animates what changed.
  let current = tracked;
  if (tracked.key !== key) {
    current = { key, marbles, anims: new Map() };
    setTracked(current);
  } else if (tracked.marbles !== marbles) {
    const fresh = diffAnims(tracked.marbles, marbles, dropDelayMs);
    const anims = fresh.size > 0 ? new Map([...tracked.anims, ...fresh]) : tracked.anims;
    current = { key, marbles, anims };
    setTracked(current);
  }

  const done = (hour: number) =>
    setTracked((t) => {
      if (!t.anims.has(hour)) return t;
      const anims = new Map(t.anims);
      anims.delete(hour);
      return { ...t, anims };
    });

  return (
    <div className="jar">
      <JarSvg
        marbles={marbles}
        onSelect={onSelect}
        label={label}
        showText
        showHours
        anims={current.anims}
        onAnimationEnd={done}
      />
    </div>
  );
}
