import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/roles';
import { getProgramLabel } from '../../data/programTypes';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import ThemeToggle from '../../components/ThemeToggle';
import PageHeader from '../../components/ui/PageHeader';

export default function CXProfile() {
  const { user, profile, role, signOut } = useAuth();
  const { program, canSwitchProgram } = useProgramAdapter();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="page cx-page">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Your CX workspace settings and sign-in details."
        icon={User}
      />

      <section className="cx-panel">
        <div className="cx-panel__body">
          <div className="cx-profile-card">
            <div className="cx-profile-card__avatar">
              {(profile?.displayName || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="cx-profile-card__info">
              <strong>{profile?.displayName || user?.displayName || '—'}</strong>
              <span className="muted">{user?.email}</span>
              <span className="muted">
                {getRoleLabel(role)} · {getProgramLabel(program)}
                {canSwitchProgram ? ' · can switch programs' : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <div className="cx-panel__head">
          <h2 className="cx-panel__title">Appearance</h2>
        </div>
        <div className="cx-panel__body">
          <div className="cx-profile-row">
            <span>Theme</span>
            <ThemeToggle compact />
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <div className="cx-panel__body">
          <button type="button" className="btn btn-danger btn-block" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
