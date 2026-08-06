import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isFullAdmin, isModeratorOnly } from '../../utils/roles';
import ThemeToggle from '../ThemeToggle';
import CXBottomNav from './CXBottomNav';
import SkipLink from '../ui/SkipLink';
import LayoutErrorBoundary from '../LayoutErrorBoundary';
import { CxProgramProvider } from '../../context/CxProgramContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { PROGRAMS } from '../../data/programTypes';

const SHORT_PROGRAM_OPTIONS = [
  { value: PROGRAMS.LEP, label: 'LEP' },
  { value: PROGRAMS.BM100, label: '100BM' },
  { value: PROGRAMS.MBW, label: 'MBW' },
];

function CxProgramBadge() {
  const { program, adapter, canSwitchProgram, setProgram } = useProgramAdapter();

  if (!canSwitchProgram) {
    return <span className="cx-program-badge">{adapter.shortLabel}</span>;
  }

  return (
    <label className="cx-program-badge cx-program-badge--select">
      <span className="sr-only">Switch program</span>
      <select
        className="cx-program-badge__select"
        value={program}
        onChange={(e) => setProgram(e.target.value)}
        aria-label="Switch CX program"
      >
        {SHORT_PROGRAM_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CxTopBar() {
  const { role } = useAuth();

  return (
    <header className="app-header cx-topbar">
      <div className="app-header__brand cx-topbar__brand">
        <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
        <span>CX</span>
        <CxProgramBadge />
      </div>
      <div className="app-header__actions">
        <ThemeToggle compact />
        {isFullAdmin(role) && (
          <Link to="/portal" className="app-header__link app-header__link--admin">
            Admin
          </Link>
        )}
        {isModeratorOnly(role) && (
          <Link to="/app/home" className="app-header__link">
            LMS
          </Link>
        )}
      </div>
    </header>
  );
}

function CxShellInner() {
  const { refreshProfile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <div className="student-layout student-layout--course cx-layout">
      <SkipLink targetId="cx-main-content" />
      <CxTopBar />
      <main id="cx-main-content" className="student-main cx-main">
        <LayoutErrorBoundary name="cx-page" resetKey={location.pathname}>
          <Outlet />
        </LayoutErrorBoundary>
      </main>
      <CXBottomNav />
    </div>
  );
}

export default function CXLayout() {
  return (
    <CxProgramProvider>
      <CxShellInner />
    </CxProgramProvider>
  );
}
