import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { isAdminRole } from '../../utils/roles';
import { ROLES } from '../../utils/roles';

export default function Profile() {
  const { user, profile, signOut, refreshProfile, role } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
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

      <form onSubmit={handleSave} className="profile-form">
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          Email
          <input value={user?.email || ''} disabled />
        </label>
        <label>
          Role
          <input value={role} disabled />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {message && <p className="success-text">{message}</p>}
      </form>

      {role === ROLES.SUPERADMIN && (
        <button type="button" className="btn btn-outline" onClick={() => navigate('/superadmin')}>
          Super Admin panel
        </button>
      )}
      {isAdminRole(role) && role !== ROLES.SUPERADMIN && (
        <button type="button" className="btn btn-outline" onClick={() => navigate('/admin')}>
          Admin dashboard
        </button>
      )}

      <section className="section">
        <h2>Help & support</h2>
        <p className="muted">Contact your IL LMS administrator for account issues.</p>
      </section>

      <button type="button" className="btn btn-danger" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}
