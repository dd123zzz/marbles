import { formatSummary, summarize } from '../lib/jar';
import { weekdayMonthDay } from '../lib/dateLabels';
import type { DateKey, Marble } from '../types';
import JarSvg from './JarSvg.tsx';

interface MiniJarProps {
  date: DateKey;
  marbles: Marble[];
  /** width in px */
  size?: number;
  /** past day with nothing logged: draw the bare jar, no marbles */
  nothingLogged?: boolean;
}

/** Static compact jar; wrap it in a link or button. */
export default function MiniJar({ date, marbles, size = 56, nothingLogged = false }: MiniJarProps) {
  const label = `${weekdayMonthDay(date)}: ${nothingLogged ? 'nothing logged' : formatSummary(summarize(marbles))}`;
  return <JarSvg marbles={nothingLogged ? [] : marbles} width={size} label={label} />;
}
