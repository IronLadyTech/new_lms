import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasMinRole } from '../utils/roles';

export function ProtectedRoute({ children, minRole }) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (minRole && !hasMinRole(role, minRole)) {
    return <Navigate to="/app/home" replace />;
  }

  return children;
}
