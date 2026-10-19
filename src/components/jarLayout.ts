const COLS = 4;
const ROWS = 6;
const CELL = 40;
const PAD = 14;
/** Room above the top row of marbles for the shoulders and the rim */
const HEADROOM = 46;

export const MARBLE_RADIUS = 16;
export const JAR_WIDTH = COLS * CELL + 2 * PAD;
export const JAR_HEIGHT = ROWS * CELL + 2 * PAD + HEADROOM;

const WALL = 3;
const NECK = 13;
const CORNER = 24;
const LIP_Y = 3;
const LIP_H = 14;
const NECK_BOTTOM = 28;
const BODY_TOP = 62;

/** Glass body (closed, for the fill): neck, rounded shoulders, straight walls, rounded base. */
export const JAR_BODY_PATH =
  `M ${NECK} ${LIP_Y + LIP_H} V ${NECK_BOTTOM} ` +
  `C ${NECK} ${NECK_BOTTOM + 18}, ${WALL} ${BODY_TOP - 22}, ${WALL} ${BODY_TOP} ` +
  `V ${JAR_HEIGHT - WALL - CORNER} ` +
  `a ${CORNER} ${CORNER} 0 0 0 ${CORNER} ${CORNER} ` +
  `H ${JAR_WIDTH - WALL - CORNER} ` +
  `a ${CORNER} ${CORNER} 0 0 0 ${CORNER} ${-CORNER} ` +
  `V ${BODY_TOP} ` +
  `C ${JAR_WIDTH - WALL} ${BODY_TOP - 22}, ${JAR_WIDTH - NECK} ${NECK_BOTTOM + 18}, ${JAR_WIDTH - NECK} ${NECK_BOTTOM} ` +
  `V ${LIP_Y + LIP_H} Z`;

/** Open top edge of the neck is not stroked, so the outline is the same path minus the lid line. */
export const JAR_OUTLINE_PATH = JAR_BODY_PATH.replace(/ Z$/, '');

export const JAR_RIM = {
  x: NECK - 6,
  y: LIP_Y,
  width: JAR_WIDTH - 2 * (NECK - 6),
  height: LIP_H,
  rx: LIP_H / 2,
};

/** Soft vertical highlight streaks on the glass. */
export const JAR_SHINE_LEFT = `M ${WALL + 10} ${BODY_TOP + 4} V ${JAR_HEIGHT - 52}`;
export const JAR_SHINE_RIGHT = `M ${JAR_WIDTH - WALL - 9} ${BODY_TOP + 10} V ${BODY_TOP + 70}`;
export const JAR_SHINE_NECK = `M ${NECK + 5} ${LIP_Y + LIP_H + 6} V ${NECK_BOTTOM + 2}`;

/** Hour 0 is the bottom-left; the jar fills left to right, then upwards. 23 is at the top. */
export function marblePosition(hour: number): { cx: number; cy: number } {
  const col = hour % COLS;
  const row = Math.floor(hour / COLS);
  return {
    cx: PAD + col * CELL + CELL / 2,
    cy: JAR_HEIGHT - PAD - row * CELL - CELL / 2,
  };
}

export const CELL_SIZE = CELL;

/** Stroke width of the glass outline (see `.jar-outline` in jar.css); colliders are inset by half of it. */
const GLASS_STROKE = 2.5;
const CURVE_SEGMENTS = 6;

export interface JarCollider {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildJarColliders(): readonly JarCollider[] {
  const pts: [number, number][] = [];
  const push = (x: number, y: number) => {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - x) > 1e-9 || Math.abs(last[1] - y) > 1e-9) pts.push([x, y]);
  };
  const cubic = (
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
  ) => {
    for (let i = 1; i <= CURVE_SEGMENTS; i++) {
      const t = i / CURVE_SEGMENTS;
      const u = 1 - t;
      push(
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      );
    }
  };
  const arc = (cx: number, cy: number, from: number, to: number) => {
    for (let i = 1; i <= CURVE_SEGMENTS; i++) {
      const a = from + ((to - from) * i) / CURVE_SEGMENTS;
      push(cx + CORNER * Math.cos(a), cy + CORNER * Math.sin(a));
    }
  };

  const lidY = LIP_Y + LIP_H;
  const floorY = JAR_HEIGHT - WALL;
  const cornerY = floorY - CORNER;
  // Same route as JAR_BODY_PATH: down the left side, along the floor, up the right side; the lid closes it.
  push(NECK, lidY);
  push(NECK, NECK_BOTTOM);
  cubic([NECK, NECK_BOTTOM], [NECK, NECK_BOTTOM + 18], [WALL, BODY_TOP - 22], [WALL, BODY_TOP]);
  push(WALL, cornerY);
  arc(WALL + CORNER, cornerY, Math.PI, Math.PI / 2);
  push(JAR_WIDTH - WALL - CORNER, floorY);
  arc(JAR_WIDTH - WALL - CORNER, cornerY, Math.PI / 2, 0);
  push(JAR_WIDTH - WALL, BODY_TOP);
  cubic(
    [JAR_WIDTH - WALL, BODY_TOP],
    [JAR_WIDTH - WALL, BODY_TOP - 22],
    [JAR_WIDTH - NECK, NECK_BOTTOM + 18],
    [JAR_WIDTH - NECK, NECK_BOTTOM],
  );
  push(JAR_WIDTH - NECK, lidY);

  // Inward normal of edge k is (dy, -dx); offset each vertex along the mitre of its two edges.
  const n = pts.length;
  const normals = pts.map((p, k) => {
    const q = pts[(k + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    return [dy / len, -dx / len] as const;
  });
  const half = GLASS_STROKE / 2;
  const inset = pts.map((p, k) => {
    const a = normals[(k + n - 1) % n];
    const b = normals[k];
    const s = 1 + a[0] * b[0] + a[1] * b[1];
    return [p[0] + (half * (a[0] + b[0])) / s, p[1] + (half * (a[1] + b[1])) / s] as const;
  });
  return inset.map((p, k) => {
    const q = inset[(k + 1) % n];
    return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] };
  });
}

/**
 * Static collision polyline of the jar's inner glass, in viewBox units (same space as
 * `marblePosition` and `MARBLE_RADIUS`). A closed loop wound so that edge (dx, dy) has its
 * interior on the side of the normal (dy, -dx). The last edge is an invisible lid at the rim.
 */
export const JAR_COLLIDERS: readonly JarCollider[] = buildJarColliders();
