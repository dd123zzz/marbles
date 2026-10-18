import type { KeyboardEvent, MouseEvent } from 'react';
import type { Marble } from '../types';
import {
  JAR_HEIGHT,
  JAR_OUTLINE_PATH,
  JAR_WIDTH,
  MARBLE_RADIUS,
  marblePosition,
} from './jarLayout';
import MarbleShape from './MarbleShape.tsx';

export interface JarSvgProps {
  marbles: Marble[];
  /** Called with the tapped slot (hour*2, or hour*2+1 for a tapped right half). Makes marbles buttons. */
  onSelect?: (slot: number, marble: Marble) => void;
  width?: number | string;
  label?: string;
  showText?: boolean;
}

function slotFor(marble: Marble, target: EventTarget): number {
  const half =
    !marble.full && target instanceof Element && target.getAttribute('data-half') === '1' ? 1 : 0;
  return marble.hour * 2 + half;
}

/** Shared drawing for the day jar and the mini jars. */
export default function JarSvg({
  marbles,
  onSelect,
  width = '100%',
  label,
  showText,
}: JarSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${JAR_WIDTH} ${JAR_HEIGHT}`}
      width={width}
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      role={onSelect ? 'group' : 'img'}
      aria-label={label}
    >
      <path d={JAR_OUTLINE_PATH} fill="none" stroke="#9ca3af" strokeWidth={2.5} />
      {marbles.map((marble) => {
        const { cx, cy } = marblePosition(marble.hour);
        const shape = (
          <MarbleShape marble={marble} cx={cx} cy={cy} r={MARBLE_RADIUS} showText={showText} />
        );
        if (!onSelect) return <g key={marble.hour}>{shape}</g>;
        return (
          <g
            key={marble.hour}
            role="button"
            tabIndex={0}
            aria-label={marble.label}
            style={{ cursor: 'pointer' }}
            onClick={(e: MouseEvent<SVGGElement>) => onSelect(slotFor(marble, e.target), marble)}
            onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(marble.hour * 2, marble);
              }
            }}
          >
            {shape}
          </g>
        );
      })}
    </svg>
  );
}
