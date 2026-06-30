import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES, isModeratorOnly, isFullAdmin } from '../../utils/roles';
import ThemeToggle from '../../components/ThemeToggle';

export default function PortalGate() {
  const { profile, role, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (isModeratorOnly(role)) {
    return <Navigate to="/cx/home" replace />;
  }

  if (!isFullAdmin(role)) {
    return <Navigate to="/app/home" replace />;
  }

  const isSuperAdmin = role === ROLES.SUPERADMIN;
  const adminPath = isSuperAdmin ? '/superadmin' : '/admin';

  return (
    <div className="portal-gate">
      <div className="portal-gate__card">
        <div className="portal-gate__theme">
          <ThemeToggle compact />
        </div>
        <img src="/logo.png" alt="Iron Lady" className="logo-mark lg portal-gate__logo" />
        <h1>Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}</h1>
        <p className="portal-gate__sub">
          You are signed in as <strong>{isSuperAdmin ? 'Super Admin' : 'Admin'}</strong>. How would you like to
          continue?
        </p>

        <div className="portal-gate__actions">
          <button type="button" className="portal-gate__btn portal-gate__btn--admin" onClick={() => navigate(adminPath)}>
            <span className="portal-gate__icon">⚙️</span>
            <span className="portal-gate__btn-title">Open admin section</span>
            <span className="portal-gate__btn-desc">
              Manage users, courses, resources, batches & track progress
            </span>
          </button>

          <button type="button" className="portal-gate__btn portal-gate__btn--user" onClick={() => navigate('/app/home')}>
            <span className="portal-gate__icon">🎓</span>
            <span className="portal-gate__btn-title">See as user</span>
            <span className="portal-gate__btn-desc">Browse courses as a user</span>
          </button>
        </div>

        <p className="portal-gate__hint muted">You can switch anytime from the app header or admin sidebar.</p>
      </div>
    </div>
  );
}
