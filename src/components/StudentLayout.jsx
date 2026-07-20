import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminRole, isModeratorOnly } from '../utils/roles';
import BottomNav from './BottomNav';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import HeaderStreak from './HeaderStreak';
import BlockedPanel from './BlockedPanel';
import SkipLink from './ui/SkipLink';

export default function StudentLayout() {
  const { role, isGuest, isBlocked, refreshProfile } = useAuth();
  const location = useLocation();
  const isMbwRoute = location.pathname.includes('/mbw');
  const isBm100Route = location.pathname.includes('/100bm');
  const isProgramTaskRoute = isMbwRoute || isBm100Route;
  const isCourseDetailRoute = /^\/app\/course\//.test(location.pathname);
  const isHomePage = /^\/app\/home\/?$/.test(location.pathname);
  const isProgressPage = /^\/app\/progress\/?$/.test(location.pathname);
  const isLightShell = isProgramTaskRoute;
  const showAdminLink = isAdminRole(role) && !isGuest;
  const accessBlocked = isBlocked && !isAdminRole(role);

  useEffect(() => {
    if (!accessBlocked) return undefined;
    const timer = setInterval(() => refreshProfile(), 30000);
    return () => clearInterval(timer);
  }, [accessBlocked, refreshProfile]);

  if (accessBlocked) {
    return (
      <div className="student-layout student-layout--blocked">
        <header className="app-header">
          <div className="app-header__brand">
            <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
            <span>LMS</span>
          </div>
          <div className="app-header__actions">
            <ThemeToggle compact />
          </div>
        </header>
        <main className="student-main">
          <div className="page">
            <BlockedPanel />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`student-layout student-layout--course${isLightShell ? ' student-layout--mbw' : ''}`}
    >
      <SkipLink />
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
          <span>LMS</span>
        </div>
        <div className="app-header__actions">
          {isGuest && <span className="guest-badge">Guest</span>}
          <HeaderStreak />
          <ThemeToggle compact />
          <NotificationBell />
          {showAdminLink && (
            <Link
              to={isModeratorOnly(role) ? '/cx/home' : '/portal'}
              className="app-header__link app-header__link--admin"
            >
              {isModeratorOnly(role) ? 'CX' : 'Admin'}
            </Link>
          )}
        </div>
      </header>
      <main
        id="main-content"
        className={`student-main${isLightShell ? ' student-main--mbw' : ''}${
          isHomePage || isProgressPage ? ' student-main--home' : ''
        }${isCourseDetailRoute ? ' student-main--wide' : ''}`}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
