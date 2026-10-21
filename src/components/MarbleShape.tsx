import type { AnimationEvent, CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { Marble, MarbleColor } from '../types';
import { CELL_SIZE } from './jarLayout';
import { halfLabel, isGlossy } from './marbleUtils';

const HALF_GAP = 1.5;
const HOUR_INK_CLASS: Partial<Record<MarbleColor | 'split', string>> = {
  b: ' marble-hour-b',
  unlogged: ' marble-hour-unlogged',
  empty: ' marble-hour-empty',
};
function paintProps(color: MarbleColor, gradId: string): { className: string; fill?: string } {
  const className = `marble marble-${color}`;
  // empty and n/a are styled in jar.css
  if (color === 'empty' || color === 'na') return { className };
  return { className, fill: `url(#${gradId}-${color})` };
}

/** Left half is :00–:30 (half 0), right half is :30–:60 (half 1). */
function halfPath(r: number, half: 0 | 1): string {
  const x = half === 0 ? -HALF_GAP : HALF_GAP;
  return `M ${x} ${-r} A ${r} ${r} 0 0 ${half === 0 ? 0 : 1} ${x} ${r} Z`;
}

export interface MarbleAnim {
  /** drop: newly logged; pop: moved between logged categories */
  kind: 'drop' | 'pop';
  /** stagger in ms */
  delay: number;
}

interface MarbleShapeProps {
  marble: Marble;
  cx: number;
  cy: number;
  r: number;
  /** unique prefix of the gradient ids defined by the parent svg */
  gradId: string;
  /** show the "n/a" text on a nonexistent (DST) hour */
  showText?: boolean;
  /** draw the hour (0–23) centered on the marble; decorative, hidden from assistive tech */
  showHour?: boolean;
  /** one-shot entrance animation; cleared by the parent in onAnimationEnd */
  anim?: MarbleAnim;
  onAnimationEnd?: (hour: number) => void;
  /** makes each target (a full marble, or each half) a keyboard-focusable button */
  onSelect?: (slot: number, marble: Marble) => void;
}

function Gloss({ r }: { r: number }) {
  return (
    <ellipse
      className="marble-gloss"
      cx={-r * 0.4}
      cy={-r * 0.45}
      rx={r * 0.28}
      ry={r * 0.17}
      transform={`rotate(-35 ${-r * 0.4} ${-r * 0.45})`}
    />
  );
}

/** One marble: a full circle, or two half circles (left :00–:30, right :30–:60). */
export default function MarbleShape({
  marble,
  cx,
  cy,
  r,
  gradId,
  showText,
  showHour,
  anim,
  onAnimationEnd,
  onSelect,
}: MarbleShapeProps) {
  const half = CELL_SIZE / 2;

  // Ink per marble: Wasted is white, Unlogged is muted, the rest dark. A split marble always
  // uses the default dark ink with a light halo, whatever its halves are.
  const hourText = (color: MarbleColor | 'split') =>
    showHour &&
    color !== 'na' && (
      <text
        className={`marble-hour${HOUR_INK_CLASS[color] ?? ''}`}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden="true"
        pointerEvents="none"
      >
        {marble.hour}
      </text>
    );

  const animated = (content: ReactNode) => (
    <g transform={`translate(${cx} ${cy})`}>
      <g
        className={anim ? `marble-anim marble-${anim.kind}` : undefined}
        style={
          anim
            ? ({
                '--marble-delay': `${anim.delay}ms`,
                '--marble-drop': `${-(cy + r + 6)}px`,
              } as CSSProperties)
            : undefined
        }
        onAnimationEnd={
          anim
            ? (e: AnimationEvent<SVGGElement>) => {
                if (e.target === e.currentTarget) onAnimationEnd?.(marble.hour);
              }
            : undefined
        }
      >
        {content}
      </g>
    </g>
  );

  const target = (
    slot: number,
    label: string,
    hit: ReactNode,
    children: ReactNode,
    ring: ReactNode,
  ) => {
    if (!onSelect) return <g key={slot}>{children}</g>;
    const activate = () => onSelect(slot, marble);
    return (
      <g
        key={slot}
        className="marble-target"
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={activate}
        onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        {hit}
        {children}
        {ring}
      </g>
    );
  };

  const hitRect = (x: number, w: number) => (
    <rect className="hit" x={x} y={-half} width={w} height={CELL_SIZE} fill="transparent" />
  );

  if (marble.full) {
    const color = marble.left;
    const body = (
      <>
        <circle r={r} {...paintProps(color, gradId)} data-half="0" />
        {isGlossy(color) && <Gloss r={r} />}
        {showText && color === 'na' && (
          <text
            className="marble-na-text"
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="central"
            pointerEvents="none"
          >
            n/a
          </text>
        )}
      </>
    );
    return animated(
      <>
        {target(
          marble.hour * 2,
          marble.label,
          hitRect(-half, CELL_SIZE),
          body,
          <circle className="focus-ring" r={r + 3} />,
        )}
        {hourText(color)}
      </>,
    );
  }

  const halves = ([0, 1] as const).map((h) => {
    const color = h === 0 ? marble.left : marble.right;
    const d = halfPath(r, h);
    return target(
      marble.hour * 2 + h,
      halfLabel(marble, h),
      hitRect(h === 0 ? -half : 0, half),
      <>
        <path d={d} {...paintProps(color, gradId)} data-half={h} />
        {h === 0 && isGlossy(color) && <Gloss r={r} />}
      </>,
      <path className="focus-ring" d={d} />,
    );
  });

  // two-tone marble: the number is centered on the seam and relies on its halo for contrast
  return animated(
    <>
      {onSelect ? (
        <g role="group" aria-label={marble.label}>
          {halves}
        </g>
      ) : (
        halves
      )}
      {hourText(marble.left === 'empty' && marble.right === 'empty' ? 'empty' : 'split')}
    </>,
  );
}
