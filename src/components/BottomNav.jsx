import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/app/dashboard', label: 'Home', icon: '🏠' },
  { to: '/app/progress', label: 'Progress', icon: '📊' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav__icon">{tab.icon}</span>
          <span className="bottom-nav__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
