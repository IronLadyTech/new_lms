import { useNavigate } from 'react-router-dom';
import {
  Lock,
  BookOpen,
  LineChart,
  Paperclip,
  LifeBuoy,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { IRON_LADY_CONTACT_EMAIL } from '../utils/constants';
import GuestRequestAccess from './guest/GuestRequestAccess';

const LOCKED_ITEMS = [
  { Icon: BookOpen, label: 'Courses' },
  { Icon: LineChart, label: 'Progress' },
  { Icon: Paperclip, label: 'Resources' },
  { Icon: LifeBuoy, label: 'Support' },
];

export default function GuestLockedPanel({ title = 'Access locked', subtitle }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignIn = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="guest-lock">
      <div className="guest-lock__glow" aria-hidden />

      <div className="guest-lock__header">
        <span className="guest-lock__icon">
          <Lock size={26} strokeWidth={2} />
        </span>
        <span className="guest-lock__badge">
          <Sparkles size={12} strokeWidth={2.5} />
          Guest preview
        </span>
      </div>

      <h2 className="guest-lock__title">{title}</h2>
      <p className="guest-lock__lead">
        {subtitle ||
          'You are browsing as a guest. Full learning features are locked until Iron Lady grants you access.'}
      </p>

      <ul className="guest-lock__features">
        {LOCKED_ITEMS.map(({ Icon, label }) => (
          <li key={label}>
            <span className="guest-lock__feature-icon">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span>{label}</span>
            <Lock size={13} className="guest-lock__feature-lock" strokeWidth={2.5} />
          </li>
        ))}
      </ul>

      <div className="guest-lock__contact-card">
        <p className="guest-lock__contact-label">Need full access?</p>
        <p className="guest-lock__contact-text">
          Explore programs on Home, then request access — or email{' '}
          <a className="guest-lock__email-inline" href={`mailto:${IRON_LADY_CONTACT_EMAIL}`}>
            {IRON_LADY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>

      <GuestRequestAccess compact />

      <div className="guest-lock__actions">
        <button type="button" className="btn btn-primary guest-lock__btn" onClick={handleSignIn}>
          <LogIn size={18} strokeWidth={2} />
          Sign in with an account
        </button>
      </div>
    </div>
  );
}
