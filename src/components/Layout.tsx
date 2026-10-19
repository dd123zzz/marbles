import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useNow } from '../hooks/useNow';
import { toDateKey } from '../lib/time';
import Reminders from '../reminders/Reminders.tsx';
import ThemeSync from '../theme/ThemeSync.tsx';
import { DayIcon, MonthIcon, SettingsIcon, StatsIcon, WeekIcon } from './icons.tsx';
import './layout.css';

function Tab({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  children: string;
}) {
  return (
    <li>
      <Link to={to} aria-current={active ? 'page' : undefined}>
        <span className="tab-icon">{icon}</span>
        <span>{children}</span>
      </Link>
    </li>
  );
}

export default function Layout() {
  const now = useNow();
  const { pathname } = useLocation();
  const today = toDateKey(now);
  const is = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <div className="app">
      <ThemeSync />
      <Reminders showBanner={pathname === '/' || pathname === `/day/${today}`} />
      <main>
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        <ul>
          <Tab to="/" active={pathname === '/' || is('/day')} icon={<DayIcon />}>
            Day
          </Tab>
          <Tab to={`/week/${today}`} active={is('/week')} icon={<WeekIcon />}>
            Week
          </Tab>
          <Tab to={`/month/${today.slice(0, 7)}`} active={is('/month')} icon={<MonthIcon />}>
            Month
          </Tab>
          <Tab to={`/stats/week/${today}`} active={is('/stats')} icon={<StatsIcon />}>
            Stats
          </Tab>
          <Tab to="/settings" active={is('/settings') || is('/export')} icon={<SettingsIcon />}>
            Settings
          </Tab>
        </ul>
      </nav>
    </div>
  );
}
