import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isGuestRole, isModeratorOnly } from '../../utils/roles';
import { ROLES } from '../../utils/roles';
import ThemeToggle from '../../components/ThemeToggle';

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { signIn, signUp, signInWithGoogle, signInAsGuest, sendPasswordReset, error, setError, profile, user, loading, role, isGuest, isBlocked } =
    useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user && !isGuest && !isBlocked && (profile || role)) {
      redirectByRole(profile?.role || role, navigate);
    }
  }, [loading, user, profile, role, isGuest, isBlocked, navigate]);

  if (loading || (user && profile && !isGuest && !isBlocked)) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInAsGuest();
      navigate('/app/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Guest login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResetSent(false);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email. Check the address and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__theme">
          <ThemeToggle compact />
        </div>
        <div className="auth-card__header">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark lg" />
          <h1>{isLogin ? 'Welcome back' : 'Create account'}</h1>
          <p>{isLogin ? 'Sign in to continue learning' : 'Sign up with email or Google'}</p>
          {isLogin && (
            <p className="auth-login-hint">
              Use your registration email and the password from your Iron Lady welcome email.
            </p>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {resetSent && (
          <div className="alert alert-success auth-forgot-sent">
            If an account exists for that email, a password reset link has been sent. Check your inbox
            and spam folder.
          </div>
        )}

        {isLogin && forgotOpen ? (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <p className="auth-forgot-copy muted">
              Enter your registered email and we&apos;ll send a secure link to reset your password.
            </p>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="btn btn-ghost auth-forgot-back"
              onClick={() => {
                setForgotOpen(false);
                setResetSent(false);
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <label>
              Display name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {isLogin && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => {
                setForgotOpen(true);
                setResetSent(false);
                setError(null);
              }}
            >
              Forgot password?
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button type="button" className="btn btn-google" onClick={handleGoogle} disabled={submitting}>
          <svg className="btn-google__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {isLogin && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <button type="button" className="btn btn-guest" onClick={handleGuest} disabled={submitting}>
              Continue as guest
            </button>
            <p className="auth-guest-note muted">
              Guest access is preview only. Courses and resources are locked — contact Iron Lady for full access.
            </p>
          </>
        )}
          </>
        )}

        {!forgotOpen && (
        <p className="auth-switch">
          {isLogin ? (
            <>
              New here? <Link to="/auth/signup">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/auth/login">Sign in</Link>
            </>
          )}
        </p>
        )}
      </div>
    </div>
  );
}

function redirectByRole(role, navigate) {
  if (isModeratorOnly(role)) {
    navigate('/cx/home', { replace: true });
    return;
  }
  if (isAdminRole(role)) {
    navigate('/portal', { replace: true });
    return;
  }
  if (isGuestRole(role)) {
    navigate('/app/home', { replace: true });
    return;
  }
  navigate('/app/home', { replace: true });
}
