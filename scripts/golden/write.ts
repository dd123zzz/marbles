import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../ios/Fixtures/golden');

export const ZONE = process.env.TZ ?? 'UTC';

export interface GoldenCase {
  fn: string;
  input: unknown;
  output: unknown;
}

const p2 = (n: number): string => String(n).padStart(2, '0');

/** Wall-clock string in the process zone; the iOS side parses it in the same zone. */
export function localStr(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/** Local wall-clock "now" from a string like 2026-03-08T03:10:00. */
export function mk(s: string): Date {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)$/.exec(s);
  if (!m) throw new Error(`bad now ${s}`);
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number);
  return new Date(y, mo - 1, d, h, mi, se);
}

export function nowInput(s: string): { now: string; nowEpochMs: number } {
  return { now: s, nowEpochMs: mk(s).getTime() };
}

export function writeGolden(module: string, cases: GoldenCase[], zoneIndependent = false): void {
  mkdirSync(OUT, { recursive: true });
  const name = zoneIndependent ? `${module}.json` : `${module}.${ZONE.replace('/', '_')}.json`;
  writeFileSync(resolve(OUT, name), JSON.stringify({ cases }, null, 2) + '\n');
}
