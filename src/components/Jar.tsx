import type { Marble } from '../types';
import JarSvg from './JarSvg.tsx';

interface JarProps {
  marbles: Marble[];
  onSelect?: (slot: number, marble: Marble) => void;
  /** accessible name of the whole jar */
  label?: string;
}

export default function Jar({ marbles, onSelect, label = 'Day jar' }: JarProps) {
  return (
    <div className="jar">
      <JarSvg marbles={marbles} onSelect={onSelect} label={label} showText />
    </div>
  );
}
