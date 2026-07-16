import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle,
  Palette,
  LayoutDashboard,
  ShieldCheck,
  LifeBuoy,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { getRoleLabel, isModeratorOnly, isFullAdmin } from '../../utils/roles';
import { ROLES } from '../../utils/roles';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ThemeToggle from '../../components/ThemeToggle';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';

export default function Profile() {
  const { user, profile, signOut, refreshProfile, role, isGuest } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirm();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, ok }

  const initial = (profile?.displayName || user?.email || '?')[0].toUpperCase();
  const hasSuperAdmin = role === ROLES.SUPERADMIN;
  const hasCx = isModeratorOnly(role);
  const hasAdmin = isFullAdmin(role) && role !== ROLES.SUPERADMIN;
  const hasWorkspace = hasSuperAdmin || hasCx || hasAdmin;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user || isGuest) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(user.uid, { displayName });
      await refreshProfile();
      setMessage({ text: 'Profile updated.', ok: true });
    } catch {
      setMessage({ text: 'Update failed. Please try again.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const requestSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to log in again to access your programs.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      variant: 'danger',
    });
    if (!ok) return;
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="page profile-page">
      <PageHeader
        eyebrow="Account"
        icon={UserCircle}
        title="Profile settings"
        subtitle="Manage your identity, preferences, and account."
      />

      <SectionCard title="Your identity" icon={UserCircle} className="profile-section">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            {initial}
          </div>
          <form onSubmit={handleSave} className="profile-form-grid">
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isGuest}
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={user?.email || (isGuest ? 'Guest session' : '')} disabled />
            </label>
            <label className="field field--full">
              <span>Role</span>
              <input value={getRoleLabel(role)} disabled />
            </label>
            {message && (
              <p
                className={`alert ${message.ok ? 'alert-success' : 'alert-error'} field--full`}
                role={message.ok ? 'status' : 'alert'}
              >
                {message.text}
              </p>
            )}
            {!isGuest && (
              <div className="profile-form-actions field--full">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </form>
        </div>
      </SectionCard>

      {isGuest && <GuestLockedPanel title="Guest preview mode" />}

      <SectionCard title="Preferences" icon={Palette} className="profile-section">
        <div className="profile-setting-row">
          <div className="profile-setting-row__text">
            <strong>Appearance</strong>
            <p className="muted">Switch between light and dark mode.</p>
          </div>
          <ThemeToggle />
        </div>
      </SectionCard>

      {hasWorkspace && (
        <SectionCard title="Workspaces" icon={LayoutDashboard} className="profile-section">
          <div className="profile-workspace-actions">
            {hasSuperAdmin && (
              <button
                type="button"
                className="btn btn-outline btn-block profile-admin-btn"
                onClick={() => navigate('/superadmin')}
              >
                <ShieldCheck size={18} strokeWidth={2} />
                Open Super Admin panel
              </button>
            )}
            {hasCx && (
              <button
                type="button"
                className="btn btn-outline btn-block profile-admin-btn"
                onClick={() => navigate('/cx/home')}
              >
                <LayoutDashboard size={18} strokeWidth={2} />
                Open CX dashboard
              </button>
            )}
            {hasAdmin && (
              <button
                type="button"
                className="btn btn-outline btn-block profile-admin-btn"
                onClick={() => navigate('/admin')}
              >
                <LayoutDashboard size={18} strokeWidth={2} />
                Open Admin dashboard
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {!isGuest && (
        <SectionCard
          title="Help & support"
          icon={LifeBuoy}
          description="Report course, login, or payment issues to Super Admin."
          className="profile-section"
        >
          <button
            type="button"
            className="btn btn-outline btn-block profile-admin-btn"
            onClick={() => navigate('/app/support')}
          >
            <LifeBuoy size={18} strokeWidth={2} />
            Open support tickets
          </button>
        </SectionCard>
      )}

      <SectionCard title="Account" icon={LogOut} className="profile-section">
        <div className="profile-setting-row">
          <div className="profile-setting-row__text">
            <strong>Sign out</strong>
            <p className="muted">End your session on this device.</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={requestSignOut}>
            <LogOut size={18} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </SectionCard>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
