import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABEL, hours, type Summary } from '../lib/jar';
import type { TimelineDay } from '../lib/jar/timeline';
import { weekdayShort } from '../lib/dateLabels';
import { parseDateKey } from '../lib/time';
import './weekTimeline.css';

export interface WeekTimelineProps {
  days: TimelineDay[];
  total: Summary;
  /** `/stats/week/${first date key}` */
  statsHref: string;
  /** The week contains today. */
  showNow: boolean;
  /** "Now 15:00" */
  nowLabel: string;
}

const LEGEND_KEYS = [...CATEGORIES, 'sleep', 'unlogged'] as const;
const GUTTER_HOURS = [0, 6, 12, 18, 24];
const cssVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

/** A 7 column x 48 row picture of the week; each column links to its day. */
export default function WeekTimeline({
  days,
  total,
  statsHref,
  showNow,
  nowLabel,
}: WeekTimelineProps) {
  const hasNa = days.some((d) => d.segments.some((s) => s.color === 'na'));
  return (
    <section className="card wt" aria-label="Week timeline">
      <div className="wt-body">
        <div className="wt-gutter" aria-hidden="true">
          <div className="wt-labels">
            {GUTTER_HOURS.map((h) => (
              <span key={h} style={cssVars({ '--h': h / 24 })}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        <ol className="wt-cols">
          {days.map((d, i) => {
            const cls = [
              'wt-col',
              d.isToday && 'today',
              d.isWeekend && 'weekend',
              d.nothingLogged && 'nothing',
            ]
              .filter(Boolean)
              .join(' ');
            const descId = `wt-desc-${d.date}`;
            return (
              <li key={d.date} className={cls}>
                <Link
                  className="wt-link"
                  to={`/day/${d.date}`}
                  aria-label={d.ariaLabel}
                  aria-describedby={d.description ? descId : undefined}
                  style={cssVars({ '--i': i })}
                >
                  <span className="wt-head" aria-hidden="true">
                    <span className="wt-dn">{weekdayShort(d.date)}</span>
                    <span className="wt-dd">{parseDateKey(d.date).getDate()}</span>
                    <span className="wt-badge">{d.isToday ? 'Today' : ''}</span>
                  </span>
                  <span className="wt-chart" aria-hidden="true">
                    {d.segments.map((s) => (
                      <span
                        key={s.start}
                        className={`wt-seg c-${s.color}`}
                        style={cssVars({ '--s': s.start, '--l': s.length })}
                        title={s.label}
                      >
                        {s.hasNote && <i className="wt-note" />}
                      </span>
                    ))}
                    {d.nowFraction !== null && (
                      <span className="wt-now" style={cssVars({ '--now': d.nowFraction })} />
                    )}
                    {d.nothingLogged && (
                      <span className="wt-none">
                        <span>Nothing logged</span>
                      </span>
                    )}
                  </span>
                  {d.description && (
                    <span className="sr-only" id={descId}>
                      {d.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      <ul className="chips wt-legend" aria-label="Week summary">
        {LEGEND_KEYS.map((k) => (
          <li key={k} className="chip">
            <span className={`dot dot-${k}`} aria-hidden="true" />
            {`${CATEGORY_LABEL[k]} ${hours(total[k])}`}
          </li>
        ))}
      </ul>
      <div className="wt-key">
        <span className="wt-k">
          <span className="dot dot-empty" aria-hidden="true" />
          Future
        </span>
        {showNow && (
          <span className="wt-k">
            <i className="wt-key-now" aria-hidden="true" />
            {nowLabel}
          </span>
        )}
        <span className="wt-k">
          <i className="wt-key-note" aria-hidden="true" />
          Note
        </span>
        {hasNa && (
          <span className="wt-k">
            <i className="wt-key-na" aria-hidden="true" />
            DST n/a
          </span>
        )}
        <Link className="stats-link" to={statsHref}>
          Week stats ›
        </Link>
      </div>
    </section>
  );
}

/** Seven flat columns shown while the week loads. */
export function WeekTimelineSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading week…
      </p>
      <section className="card wt" aria-hidden="true">
        <div className="wt-body">
          <div className="wt-gutter" />
          <ol className="wt-cols">
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="wt-col wt-skel">
                <span className="wt-head" />
                <span className="wt-chart" />
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
