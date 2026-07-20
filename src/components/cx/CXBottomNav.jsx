import { NavLink, useLocation } from 'react-router-dom';
import { Home, Layers, LineChart, ClipboardCheck, User } from 'lucide-react';

const TABS = [
  { to: '/cx/home', label: 'Home', Icon: Home },
  { to: '/cx/dashboards', label: 'Analytics', Icon: LineChart },
  { to: '/cx/batches', label: 'Batches', Icon: Layers, matchPrefix: '/cx/batches' },
  { to: '/cx/reviews', label: 'Reviews', Icon: ClipboardCheck, matchPrefix: '/cx/review' },
  { to: '/cx/profile', label: 'Profile', Icon: User },
];

export default function CXBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav" aria-label="CX navigation">
      {TABS.map(({ to, label, Icon, matchPrefix }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => {
            const active = isActive || (matchPrefix && pathname.startsWith(matchPrefix));
            return `bottom-nav__item ${active ? 'active' : ''}`;
          }}
        >
          <span className="bottom-nav__icon">
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
