import { CATEGORY_LABEL, summarize } from '../lib/jar';
import type { Marble } from '../types';

const KEYS = ['g', 'b', 'r', 'sleep', 'unlogged'] as const;

const hours = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}h`;

interface SummaryChipsProps {
  marbles: Marble[];
  /** Makes the Sleep chip a button that calls this. */
  onEditSleep?: () => void;
  /** Day shown in the Sleep button's accessible name, e.g. "Wed Oct 14". */
  dateLabel?: string;
}

/** Hours per category as chips; each pairs a marble-colored dot with its text label. */
export default function SummaryChips({ marbles, onEditSleep, dateLabel }: SummaryChipsProps) {
  const sum = summarize(marbles);
  return (
    <ul className="chips" aria-label="Summary">
      {KEYS.map((k) => {
        const text = `${CATEGORY_LABEL[k]} ${hours(sum[k])}`;
        if (k === 'sleep' && onEditSleep) {
          return (
            <li key={k}>
              <button
                type="button"
                className="chip chip-btn"
                aria-label={`Edit sleep${dateLabel ? ` for ${dateLabel}` : ''} (${text})`}
                onClick={onEditSleep}
              >
                <span key={text} className={`dot dot-${k}`} aria-hidden="true" />
                {text}
                <span className="chip-edit" aria-hidden="true">
                  ✎
                </span>
              </button>
            </li>
          );
        }
        return (
          <li key={`${k}-${text}`} className="chip">
            <span className={`dot dot-${k}`} aria-hidden="true" />
            {text}
          </li>
        );
      })}
    </ul>
  );
}
