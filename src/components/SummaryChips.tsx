import { CATEGORY_LABEL, summarize } from '../lib/jar';
import type { Marble } from '../types';

const KEYS = ['g', 'b', 'r', 'sleep', 'unlogged'] as const;

const hours = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}h`;

/** Hours per category as chips; each pairs a marble-colored dot with its text label. */
export default function SummaryChips({ marbles }: { marbles: Marble[] }) {
  const sum = summarize(marbles);
  return (
    <ul className="chips" aria-label="Summary">
      {KEYS.map((k) => (
        <li key={k} className="chip">
          <span className={`dot dot-${k}`} aria-hidden="true" />
          {CATEGORY_LABEL[k]} {hours(sum[k])}
        </li>
      ))}
    </ul>
  );
}
