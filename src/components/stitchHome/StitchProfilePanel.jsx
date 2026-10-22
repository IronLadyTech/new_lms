import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogOut, Check, AlertCircle, Camera } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { uploadAvatar } from '../../services/storageService';
import { syncPasswordResetToZoho } from '../../services/zohoService';
import { toE164, CONSENT_SOURCES } from '../../utils/contactDetails';
import { getRoleLabel } from '../../utils/roles';
import PasswordInput from '../ui/PasswordInput';
/* The panel owns these classes, so it brings its own stylesheet. Leaving that
   to Settings and Support meant the panel was styled only after one of those
   pages had been visited — opened from the dashboard it rendered bare. */
import '../../styles/stitchAccount.css';

/**
 * Everything about the person, behind the avatar in the top corner.
 *
 * These controls used to live on the Settings page, one click away from the
 * profile menu that is the obvious place to look for them. Settings now holds
 * only what is set once and applies to the app; who you are is here.
 */

const TABS = [
  ['details', 'Your details'],
  ['password', 'Password'],
];

/**
 * Changing a password here does not reach Moodle.
 *
 * Zoho carries two credential fields: `Password`, which the old Moodle LMS
 * reads, and `LMS_Password`, which this one does. Moodle writes `Password` and
 * this LMS reads it, so a change made in Moodle works everywhere. The reverse
 * does not: this LMS writes only `LMS_Password`, deliberately, so it cannot
 * break the live Moodle login.
 *
 * The consequence is that a learner who changes her password here can no longer
 * sign into Moodle — or the mobile app, which signs in against Moodle — with
 * the new one. So the form is off until the write-back to Moodle exists.
 *
 * Set VITE_PASSWORD_CHANGE_ENABLED=true to bring it back. The forgot-password
 * reset is untouched: it is the way out for somebody already locked out, and
 * removing it would strand them.
 */
const PASSWORD_CHANGE_ENABLED = import.meta.env.VITE_PASSWORD_CHANGE_ENABLED === 'true';

/** Where a password actually has to be changed while Moodle is still live. */
const MOODLE_URL = 'https://lms.iamironlady.com';

function Notice({ notice }) {
  if (!notice) return null;
  const Icon = notice.ok ? Check : AlertCircle;
  return (
    <p className={`ac-note ${notice.ok ? 'ok' : 'bad'}`} role="status">
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {notice.text}
    </p>
  );
}

export default function StitchProfilePanel({ onClose }) {
  const { user, profile, role, isGuest, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [tab, setTab] = useState('details');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappOk, setWhatsappOk] = useState(false);
  const [profession, setProfession] = useState('');
  const [experience, setExperience] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwNotice, setPwNotice] = useState(null);

  /* Mounting shows what is stored, not what was typed and abandoned before. */
  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setPhone(profile?.phone || '');
    setWhatsappOk(profile?.messagingConsent?.granted === true);
    setProfession(profile?.profession || '');
    setExperience(profile?.experience || '');
    setPhotoURL(profile?.photoURL || '');
    setNotice(null);
    setPwNotice(null);
    setPw({ current: '', next: '', confirm: '' });
  }, [profile]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* Focus lands inside the panel, not left behind on the page under it. */
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const canChangePassword = useMemo(() => {
    if (!PASSWORD_CHANGE_ENABLED) return false;
    if (!user || isGuest) return false;
    return (user.providerData || []).some((p) => p.providerId === 'password');
  }, [user, isGuest]);

  const initial = (profile?.displayName || user?.email || '?')[0].toUpperCase();

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!user || isGuest) return;
    setSaving(true);
    setNotice(null);
    try {
      const trimmed = phone.trim();
      const parsed = toE164(trimmed);
      if (trimmed && !parsed.ok) {
        setNotice({ text: `That mobile number looks ${parsed.reason}.`, ok: false });
        return;
      }
      if (whatsappOk && !parsed.ok) {
        setNotice({ text: 'Add your mobile number to get reminders on WhatsApp.', ok: false });
        return;
      }

      const update = {
        displayName,
        phone: trimmed,
        profession: profession.trim(),
        experience: experience.trim(),
      };

      /*
       * Consent is recorded with when and how it was given, because that is what
       * has to be shown if it is ever questioned. Withdrawal keeps the record
       * rather than deleting it — "she said no on this date" is also evidence.
       */
      const alreadyGranted = profile?.messagingConsent?.granted === true;
      if (whatsappOk !== alreadyGranted) {
        update.messagingConsent = {
          granted: whatsappOk,
          at: new Date().toISOString(),
          source: CONSENT_SOURCES.PROFILE,
        };
      }

      await updateUserProfile(user.uid, update);
      await refreshProfile();
      setNotice({ text: 'Saved.', ok: true });
    } catch {
      setNotice({ text: 'Update failed. Please try again.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  /*
   * The photo is saved on upload rather than waiting for Save changes: it is
   * already in storage by the time the URL comes back, so leaving the profile
   * pointing at the old one would mean an upload that silently did nothing.
   */
  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || isGuest) return;
    setPhotoBusy(true);
    setNotice(null);
    try {
      const { url } = await uploadAvatar(user.uid, file);
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshProfile();
      setPhotoURL(url);
      setNotice({ text: 'Photo updated.', ok: true });
    } catch (err) {
      setNotice({ text: err.message || 'Could not upload that photo.', ok: false });
    } finally {
      setPhotoBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!user || !canChangePassword) return;
    setPwNotice(null);

    if (pw.next.length < 8) {
      setPwNotice({ text: 'New password must be at least 8 characters.', ok: false });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwNotice({ text: 'New password and confirmation do not match.', ok: false });
      return;
    }

    setPwSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, pw.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pw.next);

      /*
       * Zoho holds LMS_Password and provisioning reads it on a first sign-in
       * elsewhere. Deliberately not awaited: the password is already changed in
       * Firebase, and a Zoho outage must not turn a successful change into an
       * error the learner cannot act on.
       */
      syncPasswordResetToZoho(pw.next, { phase: 'after_reset' }).catch((err) => {
        console.warn('Zoho credential sync after password change:', err?.message || err);
      });

      setPw({ current: '', next: '', confirm: '' });
      setPwNotice({ text: 'Password updated.', ok: true });
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
      setPwNotice({ text, ok: false });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <>
      <button type="button" className="ac-scrim" aria-label="Close profile" onClick={onClose} />
      <aside
        ref={panelRef}
        className="ac-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Your profile"
        tabIndex={-1}
      >
        <header className="ac-panel__top">
          <span className="ac-ava" aria-hidden>
            {photoURL ? <img src={photoURL} alt="" /> : initial}
          </span>
          <div className="ac-who">
            <p className="ac-who__n">{profile?.displayName || 'Learner'}</p>
            <p className="ac-who__e">{user?.email}</p>
          </div>
          <button type="button" className="ac-x" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </header>

        <p className="ac-role">{getRoleLabel(role)}</p>

        {isGuest ? (
          <div className="ac-body">
            <p className="ac-guest">You are browsing as a guest. Sign in to manage your profile.</p>
          </div>
        ) : (
          <>
            <div className="ac-tabs" role="tablist" aria-label="Profile">
              {TABS.filter(([id]) => id !== 'password' || canChangePassword).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`ac-tab${tab === id ? ' on' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ac-body">
              {tab === 'details' && (
                <form onSubmit={saveDetails} className="ac-form">
                  <div className="ac-photo">
                    <span className="ac-photo__img" aria-hidden>
                      {photoURL ? <img src={photoURL} alt="" /> : initial}
                    </span>
                    <div>
                      <p className="ac-photo__t">Profile photo</p>
                      <p className="ac-photo__h">JPG or PNG, up to 5MB.</p>
                      <button
                        type="button"
                        className="ac-btn ac-btn--quiet ac-btn--sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={photoBusy}
                      >
                        <Camera size={14} strokeWidth={2} aria-hidden />
                        {photoBusy ? 'Uploading…' : photoURL ? 'Change photo' : 'Upload photo'}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={choosePhoto}
                        aria-label="Choose a profile photo"
                      />
                    </div>
                  </div>

                  <label className="ac-f">
                    <span>Display name</span>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                    />
                  </label>

                  <label className="ac-f">
                    <span>Email</span>
                    <input value={user?.email || ''} readOnly disabled />
                    <small>Your email is your sign-in and cannot be changed here.</small>
                  </label>

                  <label className="ac-f">
                    <span>Mobile number</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="ac-f">
                    <span>Profession</span>
                    <input
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Head of Product, Founder, Consultant…"
                      autoComplete="organization-title"
                    />
                  </label>

                  <label className="ac-f">
                    <span>Years of experience</span>
                    <input
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="e.g. 12"
                      inputMode="numeric"
                    />
                  </label>

                  {!PASSWORD_CHANGE_ENABLED && !isGuest && (
                    <p className="ac-pw-note">
                      To change your password, use the Iron Lady LMS at{' '}
                      <a href={MOODLE_URL} target="_blank" rel="noopener noreferrer">
                        lms.iamironlady.com
                      </a>
                      . Changing it there keeps it working everywhere, including this app.
                    </p>
                  )}

                  <label className="ac-check">
                    <input
                      type="checkbox"
                      checked={whatsappOk}
                      onChange={(e) => setWhatsappOk(e.target.checked)}
                    />
                    <span>
                      <strong>Session reminders on WhatsApp</strong>
                      <small>
                        Reminders about your sessions and what is due. No marketing. You can turn
                        this off at any time.
                      </small>
                    </span>
                  </label>

                  <Notice notice={notice} />

                  <button type="submit" className="ac-btn ac-btn--primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </form>
              )}

              {tab === 'password' && canChangePassword && (
                <form onSubmit={changePassword} className="ac-form">
                  <label className="ac-f">
                    <span>Current password</span>
                    <PasswordInput
                      value={pw.current}
                      onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="ac-f">
                    <span>New password</span>
                    <PasswordInput
                      value={pw.next}
                      onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                      autoComplete="new-password"
                    />
                    <small>At least 8 characters.</small>
                  </label>
                  <label className="ac-f">
                    <span>Confirm new password</span>
                    <PasswordInput
                      value={pw.confirm}
                      onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </label>

                  <Notice notice={pwNotice} />

                  <button type="submit" className="ac-btn ac-btn--primary" disabled={pwSaving}>
                    {pwSaving ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        <footer className="ac-panel__foot">
          <button
            type="button"
            className="ac-btn ac-btn--danger"
            onClick={async () => {
              onClose();
              await signOut();
              navigate('/auth/login');
            }}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </footer>
      </aside>
    </>
  );
}
