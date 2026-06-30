import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { getRoleLabel, isModeratorOnly, isFullAdmin } from '../../utils/roles';
import { ROLES } from '../../utils/roles';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ThemeToggle from '../../components/ThemeToggle';

export default function Profile() {
  const { user, profile, signOut, refreshProfile, role, isGuest } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user || isGuest) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { displayName });
      await refreshProfile();
      setMessage('Profile updated.');
    } catch {
      setMessage('Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="page profile-page">
      <h1>Profile settings</h1>

      <div className="profile-avatar">
        {(profile?.displayName || user?.email || '?')[0].toUpperCase()}
      </div>

      <ThemeToggle className="profile-theme" />

      <form onSubmit={handleSave} className="profile-form">
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isGuest} />
        </label>
        <label>
          Email
          <input value={user?.email || (isGuest ? 'Guest session' : '')} disabled />
        </label>
        <label>
          Role
          <input value={getRoleLabel(role)} disabled />
        </label>
        {!isGuest && (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
        {message && <p className="success-text">{message}</p>}
      </form>

      {isGuest && <GuestLockedPanel title="Guest preview mode" />}

      {role === ROLES.SUPERADMIN && (
        <button type="button" className="btn btn-outline btn-block profile-admin-btn" onClick={() => navigate('/superadmin')}>
          <ShieldCheck size={18} strokeWidth={2} />
          Open Super Admin panel
        </button>
      )}
      {isModeratorOnly(role) && (
        <button type="button" className="btn btn-outline btn-block profile-admin-btn" onClick={() => navigate('/cx/home')}>
          <LayoutDashboard size={18} strokeWidth={2} />
          Open CX dashboard
        </button>
      )}
      {isFullAdmin(role) && role !== ROLES.SUPERADMIN && (
        <button type="button" className="btn btn-outline btn-block profile-admin-btn" onClick={() => navigate('/admin')}>
          <LayoutDashboard size={18} strokeWidth={2} />
          Open Admin dashboard
        </button>
      )}

      {!isGuest && (
        <section className="section support-card">
          <div className="support-card__head">
            <span className="support-card__icon">
              <LifeBuoy size={20} strokeWidth={2} />
            </span>
            <div>
              <h2>Help &amp; support</h2>
              <p className="muted">Report course, login, or payment issues to Super Admin.</p>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-block profile-admin-btn" onClick={() => navigate('/app/support')}>
            <LifeBuoy size={18} strokeWidth={2} />
            Open support tickets
          </button>
        </section>
      )}

      <button type="button" className="btn btn-danger" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}
