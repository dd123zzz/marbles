import { Link, Outlet, useLocation } from 'react-router-dom';
import { useNow } from '../hooks/useNow';
import { toDateKey } from '../lib/time';

function NavItem({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''}>
      {children}
    </Link>
  );
}

export default function Layout() {
  const now = useNow();
  const { pathname } = useLocation();
  const today = toDateKey(now);
  const is = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <div className="app">
      <nav className="topbar" aria-label="Main">
        <NavItem to="/" active={pathname === '/' || is('/day')}>
          Day
        </NavItem>
        <NavItem to={`/week/${today}`} active={is('/week')}>
          Week
        </NavItem>
        <NavItem to={`/month/${today.slice(0, 7)}`} active={is('/month')}>
          Month
        </NavItem>
        <NavItem to="/settings" active={is('/settings')}>
          Settings
        </NavItem>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
