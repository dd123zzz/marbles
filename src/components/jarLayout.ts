const COLS = 4;
const ROWS = 6;
const CELL = 40;
const PAD = 14;

export const MARBLE_RADIUS = 16;
export const JAR_WIDTH = COLS * CELL + 2 * PAD;
export const JAR_HEIGHT = ROWS * CELL + 2 * PAD;

const WALL = 3;
const CORNER = 14;

/** Rounded-bottom jar with an open top. */
export const JAR_OUTLINE_PATH =
  `M ${WALL} ${WALL} V ${JAR_HEIGHT - WALL - CORNER} ` +
  `a ${CORNER} ${CORNER} 0 0 0 ${CORNER} ${CORNER} ` +
  `H ${JAR_WIDTH - WALL - CORNER} ` +
  `a ${CORNER} ${CORNER} 0 0 0 ${CORNER} ${-CORNER} V ${WALL}`;

/** Hour 0 is the bottom-left; the jar fills left to right, then upwards. 23 is at the top. */
export function marblePosition(hour: number): { cx: number; cy: number } {
  const col = hour % COLS;
  const row = Math.floor(hour / COLS);
  return {
    cx: PAD + col * CELL + CELL / 2,
    cy: JAR_HEIGHT - PAD - row * CELL - CELL / 2,
  };
}
