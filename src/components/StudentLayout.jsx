import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../utils/roles';
import BottomNav from './BottomNav';
import NotificationBell from './NotificationBell';
import BlockedPanel from './BlockedPanel';

export default function StudentLayout() {
  const { role, isGuest, isBlocked, refreshProfile } = useAuth();
  const location = useLocation();
  const isCourseContext =
    location.pathname.includes('/mbw') || /^\/app\/course\//.test(location.pathname);
  const isLightShell = isCourseContext;
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
      className={`student-layout${isLightShell ? ' student-layout--mbw' : ''}${
        isCourseContext ? ' student-layout--course' : ''
      }`}
    >
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
          <span>LMS</span>
        </div>
        <div className="app-header__actions">
          {isGuest && <span className="guest-badge">Guest</span>}
          <NotificationBell />
          {showAdminLink && (
            <Link to="/portal" className="app-header__link app-header__link--admin">
              Admin
            </Link>
          )}
          <Link to="/app/home" className="app-header__link">
            Courses
          </Link>
        </div>
      </header>
      <main className={`student-main${isLightShell ? ' student-main--mbw' : ''}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
