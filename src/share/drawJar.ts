import {
  JAR_BODY_PATH,
  JAR_HEIGHT,
  JAR_OUTLINE_PATH,
  JAR_RIM,
  JAR_WIDTH,
  MARBLE_RADIUS,
  marblePosition,
} from '../components/jarLayout';
import { monthDay, weekdayShort } from '../lib/dateLabels';
import { CATEGORY_LABEL, MARBLE_COLORS, summarize, type Summary } from '../lib/jar';
import { parseDateKey } from '../lib/time';
import type { DateKey, Marble, MarbleColor } from '../types';

export const IMAGE_BG = '#faf7f2';
const INK = '#1c1917';
const MUTED = '#78716c';
const ACCENT = '#b45309';
const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
/** Output width in px; every layout is designed in logical units and scaled to this. */
export const IMAGE_PX_WIDTH = 1080;
const HALF_GAP = 1.5;

export interface ImageSize {
  /** Logical units; the canvas is `scale` times larger. */
  width: number;
  height: number;
  scale: number;
}

export const DAY_IMAGE: ImageSize = { width: 360, height: 700, scale: IMAGE_PX_WIDTH / 360 };
export const WEEK_IMAGE: ImageSize = { width: 420, height: 650, scale: IMAGE_PX_WIDTH / 420 };

export interface WeekImageDay {
  date: DateKey;
  marbles: Marble[];
}

/** "Sat, Oct 18, 2026" */
export function imageDate(date: DateKey): string {
  return `${weekdayShort(date)}, ${monthDay(date)}, ${parseDateKey(date).getFullYear()}`;
}

/** "Week of Oct 12, 2026" */
export function weekTitle(firstDay: DateKey): string {
  return `Week of ${monthDay(firstDay)}, ${parseDateKey(firstDay).getFullYear()}`;
}

export const formatHours = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}h`;

function sumSummaries(list: Summary[]): Summary {
  const total: Summary = { g: 0, b: 0, r: 0, sleep: 0, unlogged: 0 };
  for (const s of list)
    for (const k of Object.keys(total) as Array<keyof Summary>) total[k] += s[k];
  return total;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintShape(
  ctx: CanvasRenderingContext2D,
  color: MarbleColor,
  cx: number,
  cy: number,
  r: number,
  half: 0 | 1 | 'full',
): void {
  const x = half === 'full' ? cx : cx + (half === 0 ? -HALF_GAP : HALF_GAP);
  ctx.beginPath();
  if (half === 'full') ctx.arc(x, cy, r, 0, Math.PI * 2);
  else if (half === 0) ctx.arc(x, cy, r, Math.PI / 2, (Math.PI * 3) / 2);
  else ctx.arc(x, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  if (color === 'empty') {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#b8ad9d';
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = MARBLE_COLORS[color];
  ctx.fill();
}

function drawMarble(
  ctx: CanvasRenderingContext2D,
  m: Marble,
  cx: number,
  cy: number,
  r: number,
  showNumber: boolean,
): void {
  if (m.full) {
    paintShape(ctx, m.left, cx, cy, r, 'full');
  } else {
    paintShape(ctx, m.left, cx, cy, r, 0);
    paintShape(ctx, m.right, cx, cy, r, 1);
  }
  if (m.left !== 'empty' && m.left !== 'na') {
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.28, r * 0.17, -0.61, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
  }
  if (showNumber) {
    ctx.font = `700 ${r * 0.72}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.85)';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(String(m.hour), cx, cy + 0.5);
    ctx.fillText(String(m.hour), cx, cy + 0.5);
  }
}

/** Draws one jar with its top-left corner at (x, y), `width` logical units wide. */
export function drawJar(
  ctx: CanvasRenderingContext2D,
  marbles: Marble[],
  x: number,
  y: number,
  width: number,
  showNumbers: boolean,
): void {
  const k = width / JAR_WIDTH;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  const glass = ctx.createLinearGradient(0, 0, 0, JAR_HEIGHT);
  glass.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  glass.addColorStop(1, 'rgba(214, 232, 240, 0.7)');
  ctx.fillStyle = glass;
  ctx.fill(new Path2D(JAR_BODY_PATH));

  for (const m of marbles) {
    const { cx, cy } = marblePosition(m.hour);
    drawMarble(ctx, m, cx, cy, MARBLE_RADIUS, showNumbers);
  }

  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#a9b9c2';
  ctx.stroke(new Path2D(JAR_OUTLINE_PATH));
  roundedRect(ctx, JAR_RIM.x, JAR_RIM.y, JAR_RIM.width, JAR_RIM.height, JAR_RIM.rx);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { size: number; weight?: number; color?: string; align?: CanvasTextAlign },
): void {
  ctx.font = `${opts.weight ?? 400} ${opts.size}px ${FONT}`;
  ctx.fillStyle = opts.color ?? INK;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function background(ctx: CanvasRenderingContext2D, size: ImageSize): void {
  ctx.fillStyle = IMAGE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
}

/** Colored dot + label above the hours, centered on `cx`. */
function stat(
  ctx: CanvasRenderingContext2D,
  key: keyof Summary,
  sum: Summary,
  cx: number,
  y: number,
): void {
  ctx.beginPath();
  ctx.arc(cx - 34, y - 4, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = MARBLE_COLORS[key];
  ctx.fill();
  text(ctx, CATEGORY_LABEL[key], cx - 26, y, { size: 12, color: MUTED, weight: 600 });
  text(ctx, formatHours(sum[key]), cx, y + 26, { size: 22, weight: 700, align: 'center' });
}

/** Draws the whole day image onto a canvas context sized DAY_IMAGE × scale. */
export function drawDayImage(
  ctx: CanvasRenderingContext2D,
  input: { date: DateKey; marbles: Marble[] },
): void {
  const size = DAY_IMAGE;
  ctx.save();
  ctx.scale(size.scale, size.scale);
  background(ctx, size);
  text(ctx, 'Marbles', 24, 38, { size: 14, weight: 800, color: ACCENT });
  text(ctx, imageDate(input.date), 24, 74, { size: 27, weight: 800 });

  const jarW = 254;
  drawJar(ctx, input.marbles, (size.width - jarW) / 2, 100, jarW, true);

  const sum = summarize(input.marbles);
  const inner = size.width - 48;
  (['g', 'b', 'r'] as const).forEach((k, i) =>
    stat(ctx, k, sum, 24 + (inner / 3) * (i + 0.5) + 12, 574),
  );
  (['sleep', 'unlogged'] as const).forEach((k, i) =>
    stat(ctx, k, sum, 24 + inner * (i === 0 ? 0.3 : 0.7) + 12, 642),
  );
  ctx.restore();
}

/** Seven mini jars in a 4 + 3 grid; the eighth cell holds the week's totals. */
export function drawWeekImage(
  ctx: CanvasRenderingContext2D,
  input: { title: string; days: WeekImageDay[] },
): void {
  const size = WEEK_IMAGE;
  ctx.save();
  ctx.scale(size.scale, size.scale);
  background(ctx, size);
  text(ctx, 'Marbles', 24, 38, { size: 14, weight: 800, color: ACCENT });
  text(ctx, input.title, 24, 72, { size: 26, weight: 800 });

  const cols = 4;
  const cell = (size.width - 32) / cols;
  const jarW = 78;
  const jarH = (jarW * JAR_HEIGHT) / JAR_WIDTH;
  const rowH = jarH + 52;
  input.days.slice(0, 7).forEach((d, i) => {
    const x0 = 16 + (i % cols) * cell;
    const y0 = 100 + Math.floor(i / cols) * rowH;
    drawJar(ctx, d.marbles, x0 + (cell - jarW) / 2, y0, jarW, false);
    const cx = x0 + cell / 2;
    text(ctx, weekdayShort(d.date), cx, y0 + jarH + 20, { size: 14, weight: 700, align: 'center' });
    text(ctx, String(parseDateKey(d.date).getDate()), cx, y0 + jarH + 38, {
      size: 12,
      color: MUTED,
      align: 'center',
    });
  });

  const total = sumSummaries(input.days.map((d) => summarize(d.marbles)));
  const inner = size.width - 48;
  const statsY = 100 + 2 * rowH + 20;
  text(ctx, 'Week total', 24, statsY, { size: 12, weight: 700, color: MUTED });
  (['g', 'b', 'r'] as const).forEach((k, i) =>
    stat(ctx, k, total, 24 + (inner / 3) * (i + 0.5) + 12, statsY + 34),
  );
  (['sleep', 'unlogged'] as const).forEach((k, i) =>
    stat(ctx, k, total, 24 + inner * (i === 0 ? 0.3 : 0.7) + 12, statsY + 102),
  );
  ctx.restore();
}
