import { CATEGORY_LABEL, MARBLE_COLORS } from '../lib/jar';
import type { Marble, MarbleColor } from '../types';
import JarSvg from './JarSvg.tsx';

const LEGEND: MarbleColor[] = ['g', 'b', 'r', 'sleep', 'unlogged'];

interface JarProps {
  marbles: Marble[];
  onSelect?: (slot: number, marble: Marble) => void;
  /** accessible name of the whole jar */
  label?: string;
}

export default function Jar({ marbles, onSelect, label = 'Day jar' }: JarProps) {
  return (
    <div className="jar">
      <div style={{ maxWidth: 280, margin: '0 auto' }}>
        <JarSvg marbles={marbles} onSelect={onSelect} label={label} showText />
      </div>
      <ul className="legend" aria-label="Legend">
        {LEGEND.map((c) => (
          <li key={c}>
            <span
              className="swatch"
              aria-hidden="true"
              style={{
                background: MARBLE_COLORS[c],
                borderColor: c === 'b' ? '#d1d5db' : 'transparent',
              }}
            />
            {CATEGORY_LABEL[c]}
          </li>
        ))}
      </ul>
    </div>
  );
}
