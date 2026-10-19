import { it } from 'vitest';
import * as L from '../../src/components/jarLayout';
import { type GoldenCase, writeGolden } from './write';

it('geometry golden', () => {
  const c: GoldenCase[] = [];
  for (const [k, v] of Object.entries(L)) {
    if (typeof v !== 'function') c.push({ fn: `const:${k}`, input: {}, output: v });
  }
  for (let h = 0; h < 24; h++) {
    c.push({ fn: 'marblePosition', input: { hour: h }, output: L.marblePosition(h) });
  }
  writeGolden('geometry', c, true);
});
