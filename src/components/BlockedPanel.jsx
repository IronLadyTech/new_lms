import { Link } from 'react-router-dom';
import { Ban, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { IRON_LADY_CONTACT_EMAIL } from '../utils/constants';

export default function BlockedPanel() {
  const { signOut } = useAuth();

  return (
    <div className="guest-lock blocked-panel">
      <div className="guest-lock__glow blocked-panel__glow" aria-hidden />
      <span className="guest-lock__icon blocked-panel__icon">
        <Ban size={26} strokeWidth={2} />
      </span>
      <h2 className="guest-lock__title">Account blocked</h2>
      <p className="guest-lock__lead">
        Your access to courses, resources, calendar, and support has been restricted by an administrator.
      </p>
      <p className="guest-lock__contact">Contact <strong>Iron Lady</strong> to restore access:</p>
      <a className="guest-lock__email" href={`mailto:${IRON_LADY_CONTACT_EMAIL}`}>
        <Mail size={17} strokeWidth={2} />
        {IRON_LADY_CONTACT_EMAIL}
      </a>
      <div className="guest-lock__actions">
        <button type="button" className="btn btn-danger guest-lock__btn" onClick={() => signOut()}>
          Sign out
        </button>
        <Link to="/auth/login" className="btn btn-outline guest-lock__btn">
          Back to login
        </Link>
      </div>
    </div>
  );
}
