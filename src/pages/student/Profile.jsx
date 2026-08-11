import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Palette, LifeBuoy, LogOut, KeyRound, Bell } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { getRoleLabel } from '../../utils/roles';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ThemeToggle from '../../components/ThemeToggle';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import PasswordInput from '../../components/ui/PasswordInput';

const NOTIFY_KEY = 'il-lms-notify-prefs';

function loadNotifyPrefs() {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (!raw) return { announcements: true, reminders: true };
    return { announcements: true, reminders: true, ...JSON.parse(raw) };
  } catch {
    return { announcements: true, reminders: true };
  }
}

export default function Profile() {
  const { user, profile, signOut, refreshProfile, role, isGuest } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirm();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [notifyPrefs, setNotifyPrefs] = useState(loadNotifyPrefs);

  const initial = (profile?.displayName || user?.email || '?')[0].toUpperCase();
  const canChangePassword = useMemo(() => {
    if (!user || isGuest) return false;
    return (user.providerData || []).some((p) => p.providerId === 'password');
  }, [user, isGuest]);

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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user || !canChangePassword) return;
    setPasswordMessage(null);

    if (passwordForm.next.length < 8) {
      setPasswordMessage({ text: 'New password must be at least 8 characters.', ok: false });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ text: 'New password and confirmation do not match.', ok: false });
      return;
    }

    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setPasswordMessage({ text: 'Password updated.', ok: true });
    } catch (err) {
      const code = err?.code || '';
      let text = 'Could not update password. Please try again.';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        text = 'Current password is incorrect.';
      } else if (code === 'auth/weak-password') {
        text = 'Choose a stronger password (at least 8 characters).';
      } else if (code === 'auth/requires-recent-login') {
        text = 'For security, sign out and sign in again, then change your password.';
      }
      setPasswordMessage({ text, ok: false });
    } finally {
      setPasswordSaving(false);
    }
  };

  const updateNotifyPref = (key, value) => {
    setNotifyPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
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

      {!isGuest && canChangePassword && (
        <SectionCard title="Password" icon={KeyRound} className="profile-section">
          <form className="support-form" onSubmit={handlePasswordChange}>
            <div className="field">
              <label htmlFor="profile-current-password">Current password</label>
              <PasswordInput
                id="profile-current-password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="profile-new-password">New password</label>
              <PasswordInput
                id="profile-new-password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-confirm-password">Confirm new password</label>
              <PasswordInput
                id="profile-confirm-password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {passwordMessage && (
              <p
                className={`alert ${passwordMessage.ok ? 'alert-success' : 'alert-error'}`}
                role={passwordMessage.ok ? 'status' : 'alert'}
              >
                {passwordMessage.text}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={passwordSaving}>
              {passwordSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </SectionCard>
      )}

      {!isGuest && !canChangePassword && (
        <SectionCard title="Password" icon={KeyRound} className="profile-section">
          <p className="muted">
            This account signs in without an email password (for example Google). Password change is
            not available here.
          </p>
        </SectionCard>
      )}

      <SectionCard title="Preferences" icon={Palette} className="profile-section">
        <div className="profile-setting-row">
          <div className="profile-setting-row__text">
            <strong>Appearance</strong>
            <p className="muted">
              Switch between light and dark mode. Defaults to your system preference.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </SectionCard>

      {!isGuest && (
        <SectionCard title="Notifications" icon={Bell} className="profile-section">
          <div className="profile-setting-row">
            <div className="profile-setting-row__text">
              <strong>Announcements</strong>
              <p className="muted">Program updates and Iron Lady broadcasts.</p>
            </div>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={notifyPrefs.announcements}
                onChange={(e) => updateNotifyPref('announcements', e.target.checked)}
              />
              <span className="sr-only">Announcements</span>
            </label>
          </div>
          <div className="profile-setting-row">
            <div className="profile-setting-row__text">
              <strong>Session reminders</strong>
              <p className="muted">Reminders for upcoming live sessions.</p>
            </div>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={notifyPrefs.reminders}
                onChange={(e) => updateNotifyPref('reminders', e.target.checked)}
              />
              <span className="sr-only">Session reminders</span>
            </label>
          </div>
          <p className="muted profile-notify-note">
            Preferences are saved on this device. Push delivery still follows your browser
            permission.
          </p>
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
