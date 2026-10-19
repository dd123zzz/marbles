import { useId } from 'react';
import type { Marble } from '../types';
import {
  JAR_BODY_PATH,
  JAR_HEIGHT,
  JAR_OUTLINE_PATH,
  JAR_RIM,
  JAR_SHINE_LEFT,
  JAR_SHINE_NECK,
  JAR_SHINE_RIGHT,
  JAR_WIDTH,
  MARBLE_RADIUS,
  marblePosition,
} from './jarLayout';
import MarbleShape, { type MarbleAnim } from './MarbleShape.tsx';
import { GRADIENT_COLORS } from './marbleUtils';
import './jar.css';

export interface JarSvgProps {
  marbles: Marble[];
  /**
   * Called with the selected slot (hour*2 for the :00–:30 half or a full marble, hour*2+1 for
   * the :30–:60 half). Makes each full marble, and each half of a split marble, a button.
   */
  onSelect?: (slot: number, marble: Marble) => void;
  width?: number | string;
  label?: string;
  showText?: boolean;
  /** hour numbers on the marbles (day jar only) */
  showHours?: boolean;
  /** entrance animations keyed by hour */
  anims?: ReadonlyMap<number, MarbleAnim>;
  onAnimationEnd?: (hour: number) => void;
}

/** Marble and glass gradients, with ids prefixed by `gradId` (unique per svg); marbles are drawn around their own origin. */
export function JarDefs({ gradId }: { gradId: string }) {
  const r = MARBLE_RADIUS;
  return (
    <defs>
      {GRADIENT_COLORS.map((c) => (
        <radialGradient
          key={c}
          id={`${gradId}-${c}`}
          gradientUnits="userSpaceOnUse"
          cx={-r * 0.35}
          cy={-r * 0.4}
          fx={-r * 0.4}
          fy={-r * 0.45}
          r={r * 1.5}
        >
          <stop offset="0" style={{ stopColor: `var(--marble-${c}-hi)` }} />
          <stop offset="0.42" style={{ stopColor: `var(--marble-${c})` }} />
          <stop offset="1" style={{ stopColor: `var(--marble-${c}-lo)` }} />
        </radialGradient>
      ))}
      <linearGradient id={`${gradId}-glass`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--glass-top)' }} />
        <stop offset="1" style={{ stopColor: 'var(--glass-bottom)' }} />
      </linearGradient>
    </defs>
  );
}

/** The glass body fill; draw it before the marbles. */
export function JarGlassFill({ gradId }: { gradId: string }) {
  return <path d={JAR_BODY_PATH} fill={`url(#${gradId}-glass)`} />;
}

/** Outline, shine and rim; draw it after the marbles. */
export function JarGlassOverlay() {
  return (
    <g className="jar-glass" pointerEvents="none">
      <path className="jar-outline" d={JAR_OUTLINE_PATH} fill="none" />
      <path className="jar-shine" d={JAR_SHINE_LEFT} />
      <path className="jar-shine jar-shine-soft" d={JAR_SHINE_RIGHT} />
      <path className="jar-shine jar-shine-soft" d={JAR_SHINE_NECK} />
      <rect className="jar-rim" {...JAR_RIM} />
    </g>
  );
}

/** Shared drawing for the day jar and the mini jars. */
export default function JarSvg({
  marbles,
  onSelect,
  width = '100%',
  label,
  showText,
  showHours,
  anims,
  onAnimationEnd,
}: JarSvgProps) {
  const gradId = `jar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = MARBLE_RADIUS;
  return (
    <svg
      className="jar-svg"
      viewBox={`0 0 ${JAR_WIDTH} ${JAR_HEIGHT}`}
      width={width}
      role={onSelect ? 'group' : 'img'}
      aria-label={label}
    >
      <JarDefs gradId={gradId} />
      <JarGlassFill gradId={gradId} />
      {marbles.map((marble) => {
        const { cx, cy } = marblePosition(marble.hour);
        return (
          <MarbleShape
            key={marble.hour}
            marble={marble}
            cx={cx}
            cy={cy}
            r={r}
            gradId={gradId}
            showText={showText}
            showHour={showHours}
            anim={anims?.get(marble.hour)}
            onAnimationEnd={onAnimationEnd}
            onSelect={onSelect}
          />
        );
      })}
      <JarGlassOverlay />
    </svg>
  );
}
