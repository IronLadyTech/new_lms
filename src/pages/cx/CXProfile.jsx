import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/roles';
import { getProgramLabel } from '../../data/programTypes';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import ThemeToggle from '../../components/ThemeToggle';

export default function CXProfile() {
  const { user, profile, role, signOut } = useAuth();
  const { program } = useProgramAdapter();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="page cx-page">
      <h1>Profile</h1>
      <p className="page-sub">Settings &amp; account</p>

      <section className="cx-section">
        <div className="cx-profile-card">
          <div className="cx-profile-card__avatar">
            {(profile?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="cx-profile-card__info">
            <strong>{profile?.displayName || user?.displayName || '—'}</strong>
            <span className="muted">{user?.email}</span>
            <span className="muted">
              {getRoleLabel(role)} · {getProgramLabel(program)}
            </span>
          </div>
        </div>
      </section>

      <section className="cx-section">
        <div className="cx-profile-row">
          <span>Theme</span>
          <ThemeToggle compact />
        </div>
      </section>

      <section className="cx-section">
        <button type="button" className="btn btn-danger btn-block" onClick={handleSignOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
