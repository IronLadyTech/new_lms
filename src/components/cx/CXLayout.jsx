import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFullAdmin } from '../../utils/roles';
import ThemeToggle from '../ThemeToggle';
import CXBottomNav from './CXBottomNav';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';

export default function CXLayout() {
  const { role } = useAuth();
  const { adapter } = useProgramAdapter();

  return (
    <div className="student-layout cx-layout">
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
          <span>CX</span>
          <span className="cx-program-badge">{adapter.shortLabel}</span>
        </div>
        <div className="app-header__actions">
          <ThemeToggle compact />
          {isFullAdmin(role) && (
            <Link to="/portal" className="app-header__link app-header__link--admin">
              Admin
            </Link>
          )}
        </div>
      </header>
      <main className="student-main cx-main">
        <Outlet />
      </main>
      <CXBottomNav />
    </div>
  );
}
