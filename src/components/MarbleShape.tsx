import { MARBLE_COLORS } from '../lib/jar';
import type { Marble, MarbleColor } from '../types';

const HALF_GAP = 1.5;

interface Paint {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

function paint(color: MarbleColor): Paint {
  if (color === 'empty') {
    return { fill: 'none', stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '3 3' };
  }
  // black marbles get a light edge so they stay visible on dark backgrounds
  if (color === 'b') return { fill: MARBLE_COLORS.b, stroke: '#d1d5db', strokeWidth: 1 };
  return { fill: MARBLE_COLORS[color] };
}

interface MarbleShapeProps {
  marble: Marble;
  cx: number;
  cy: number;
  r: number;
  /** show the "n/a" text on a nonexistent (DST) hour */
  showText?: boolean;
}

/** One marble: a full circle, or two half circles (left :00–:30, right :30–:60). */
export default function MarbleShape({ marble, cx, cy, r, showText }: MarbleShapeProps) {
  if (marble.full) {
    return (
      <>
        <circle cx={cx} cy={cy} r={r} data-half="0" {...paint(marble.left)} />
        {showText && marble.left === 'na' && (
          <text
            x={cx}
            y={cy}
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#6b7280"
            pointerEvents="none"
          >
            n/a
          </text>
        )}
      </>
    );
  }
  const top = cy - r;
  const bottom = cy + r;
  return (
    <>
      <path
        d={`M ${cx} ${top} A ${r} ${r} 0 0 0 ${cx} ${bottom} Z`}
        transform={`translate(${-HALF_GAP} 0)`}
        data-half="0"
        {...paint(marble.left)}
      />
      <path
        d={`M ${cx} ${top} A ${r} ${r} 0 0 1 ${cx} ${bottom} Z`}
        transform={`translate(${HALF_GAP} 0)`}
        data-half="1"
        {...paint(marble.right)}
      />
    </>
  );
}
