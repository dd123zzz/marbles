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
