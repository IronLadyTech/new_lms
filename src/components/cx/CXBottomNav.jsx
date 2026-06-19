import { NavLink } from 'react-router-dom';
import { Home, Layers, LineChart, User } from 'lucide-react';

const TABS = [
  { to: '/cx/home', label: 'Home', Icon: Home },
  { to: '/cx/batches', label: 'Batch', Icon: Layers },
  { to: '/cx/dashboards', label: 'Dashboards', Icon: LineChart },
  { to: '/cx/profile', label: 'Profile', Icon: User },
];

export default function CXBottomNav() {
  return (
    <nav className="bottom-nav" aria-label="CX navigation">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}
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
