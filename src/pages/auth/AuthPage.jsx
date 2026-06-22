import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isGuestRole } from '../../utils/roles';
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
  if (isAdminRole(role)) navigate('/portal', { replace: true });
  else if (isGuestRole(role)) navigate('/app/home', { replace: true });
  else navigate('/app/home', { replace: true });
}
