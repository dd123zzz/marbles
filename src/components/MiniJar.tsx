import { formatSummary, summarize } from '../lib/jar';
import { weekdayMonthDay } from '../lib/dateLabels';
import type { DateKey, Marble } from '../types';
import JarSvg from './JarSvg.tsx';

interface MiniJarProps {
  date: DateKey;
  marbles: Marble[];
  /** width in px */
  size?: number;
}

/** Static compact jar; wrap it in a link or button. */
export default function MiniJar({ date, marbles, size = 56 }: MiniJarProps) {
  const label = `${weekdayMonthDay(date)}: ${formatSummary(summarize(marbles))}`;
  return <JarSvg marbles={marbles} width={size} label={label} />;
}
