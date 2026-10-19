import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MARBLE_RADIUS } from '../components/jarLayout';
import { computeMarbles } from '../lib/jar';
import type { Marble, MarbleColor } from '../types';
import {
  drawDayImage,
  drawWeekImage,
  formatHours,
  imageDate,
  weekTitle,
  DAY_IMAGE,
  IMAGE_BG,
} from './drawJar';

interface Call {
  fn: string;
  args: unknown[];
}

function mockCtx() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {};
  const fills: unknown[] = [];
  const target = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop in state) return state[prop];
      return (...args: unknown[]) => {
        calls.push({ fn: prop, args });
        if (prop === 'fill' || prop === 'fillText' || prop === 'fillRect')
          fills.push(state.fillStyle);
      };
    },
    set(_t, prop: string, value) {
      state[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, fills };
}

const of = (calls: Call[], fn: string) => calls.filter((c) => c.fn === fn);
const marbleArcs = (calls: Call[]) => of(calls, 'arc').filter((c) => c.args[2] === MARBLE_RADIUS);

function marbles(colors: Array<[MarbleColor, MarbleColor]> = []): Marble[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const [left, right] = colors[hour] ?? ['g', 'g'];
    return { hour, left, right, full: left === right, label: `h${hour}` };
  });
}

beforeEach(() => {
  vi.stubGlobal('Path2D', class {});
});

describe('drawDayImage', () => {
  it('draws 24 full marbles with one arc each, plus the hour numbers 0–23', () => {
    const { ctx, calls } = mockCtx();
    drawDayImage(ctx, { date: '2026-10-18', marbles: marbles() });
    expect(marbleArcs(calls)).toHaveLength(24);
    const texts = of(calls, 'fillText').map((c) => c.args[0]);
    for (let h = 0; h < 24; h++) expect(texts).toContain(String(h));
    // numbers are white with a dark outline
    expect(of(calls, 'strokeText')).toHaveLength(24);
  });

  it('draws a half marble as two half-circle arcs', () => {
    const { ctx, calls } = mockCtx();
    const list = marbles([['g', 'b']]);
    drawDayImage(ctx, { date: '2026-10-18', marbles: list });
    expect(marbleArcs(calls)).toHaveLength(25);
    const halves = marbleArcs(calls).slice(0, 2);
    const [left, right] = halves;
    expect(left.args[3]).toBeCloseTo(Math.PI / 2);
    expect(left.args[4]).toBeCloseTo((Math.PI * 3) / 2);
    expect(right.args[3]).toBeCloseTo(-Math.PI / 2);
    expect(right.args[4]).toBeCloseTo(Math.PI / 2);
  });

  it('writes the app name, date and the summary hours', () => {
    const { ctx, calls } = mockCtx();
    const list = computeMarbles({
      date: '2026-10-18',
      slots: 'gggggggggggggggg' + '.'.repeat(32),
      sleep: { start: '23:00', end: '07:00' },
      now: new Date(2026, 9, 19, 12),
    });
    drawDayImage(ctx, { date: '2026-10-18', marbles: list });
    const texts = of(calls, 'fillText').map((c) => c.args[0]);
    expect(texts).toContain('Marbles');
    expect(texts).toContain('Sun, Oct 18, 2026');
    expect(texts).toEqual(
      expect.arrayContaining(['Wanted', 'Wasted', 'Unwanted', 'Sleep', 'Unlogged']),
    );
    // logged 00:00–08:00 wins over the sleep window, so only 23:00–24:00 shows as sleep
    expect(texts).toContain('8h');
    expect(texts).toContain('1h');
  });

  it('fills with the light background at 3x scale regardless of theme', () => {
    const { ctx, calls, fills } = mockCtx();
    drawDayImage(ctx, { date: '2026-10-18', marbles: marbles() });
    expect(DAY_IMAGE.width * DAY_IMAGE.scale).toBe(1080);
    expect(of(calls, 'scale')[0].args).toEqual([DAY_IMAGE.scale, DAY_IMAGE.scale]);
    const bg = of(calls, 'fillRect')[0];
    expect(bg.args).toEqual([0, 0, DAY_IMAGE.width, DAY_IMAGE.height]);
    expect(fills[0]).toBe(IMAGE_BG);
  });

  it('outlines future (empty) halves instead of filling them', () => {
    const { ctx, calls } = mockCtx();
    drawDayImage(ctx, { date: '2026-10-18', marbles: marbles([['empty', 'empty']]) });
    expect(of(calls, 'setLineDash').length).toBeGreaterThan(0);
  });
});

describe('drawWeekImage', () => {
  const days = [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
  ].map((date) => ({ date, marbles: marbles() }));

  it('draws seven jars, weekday labels, the title and week totals', () => {
    const { ctx, calls } = mockCtx();
    drawWeekImage(ctx, { title: weekTitle('2026-10-12'), days });
    expect(marbleArcs(calls)).toHaveLength(7 * 24);
    const texts = of(calls, 'fillText').map((c) => c.args[0]);
    expect(texts).toContain('Week of Oct 12, 2026');
    expect(texts).toEqual(
      expect.arrayContaining(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
    );
    expect(texts).toContain('Week total');
    expect(texts).toContain('168h');
    // mini jars carry no hour numbers
    expect(of(calls, 'strokeText')).toHaveLength(0);
  });

  it('draws no marbles for a past day with nothing logged, but keeps its label', () => {
    const { ctx, calls } = mockCtx();
    const mixed = days.map((d, i) => (i === 1 ? { ...d, nothingLogged: true } : d));
    drawWeekImage(ctx, { title: weekTitle('2026-10-12'), days: mixed });
    expect(marbleArcs(calls)).toHaveLength(6 * 24);
    expect(of(calls, 'fillText').map((c) => c.args[0])).toContain('Tue');
  });
});

describe('labels', () => {
  it('formats the date and hours', () => {
    expect(imageDate('2026-10-18')).toBe('Sun, Oct 18, 2026');
    expect(formatHours(7.5)).toBe('7.5h');
    expect(formatHours(8)).toBe('8h');
  });
});
