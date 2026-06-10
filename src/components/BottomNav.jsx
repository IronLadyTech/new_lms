import { NavLink } from 'react-router-dom';
import { Home, LineChart, CalendarDays, MessageCircle, User } from 'lucide-react';

const TABS = [
  { to: '/app/dashboard', label: 'Home', Icon: Home },
  { to: '/app/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/app/progress', label: 'Progress', Icon: LineChart },
  { to: '/app/support', label: 'Support', Icon: MessageCircle },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
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
