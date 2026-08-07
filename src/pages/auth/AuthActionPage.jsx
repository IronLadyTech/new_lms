import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/ThemeToggle';
import PasswordInput from '../../components/ui/PasswordInput';
import AuthBrandHeader from '../../components/auth/AuthBrandHeader';

export default function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const { completePasswordReset, error, setError } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (mode !== 'resetPassword' || !oobCode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__theme">
            <ThemeToggle compact />
          </div>
          <div className="auth-card__header">
            <AuthBrandHeader />
            <h1>Invalid link</h1>
            <p>This password reset link is missing or expired.</p>
          </div>
          <Link to="/auth/login" className="btn btn-primary">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await completePasswordReset(oobCode, password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setError(err.message || 'Could not reset password. Request a new link and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <AuthBrandHeader />
            <h1>Password updated</h1>
            <p>
              Your new password is active and has been synced to your Zoho record. Redirecting you
              now…
            </p>
          </div>
          <p className="auth-forgot-sent muted">Redirecting you now…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__theme">
          <ThemeToggle compact />
        </div>
        <div className="auth-card__header">
          <AuthBrandHeader />
          <h1>Set a new password</h1>
          <p>Choose a strong password for your account.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            New password
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              aria-label="New password"
            />
          </label>
          <label>
            Confirm password
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              aria-label="Confirm password"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/auth/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
