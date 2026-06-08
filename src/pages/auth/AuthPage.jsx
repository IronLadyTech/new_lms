import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isGuestRole } from '../../utils/roles';
import { ROLES } from '../../utils/roles';

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { signIn, signUp, signInWithGoogle, signInAsGuest, error, setError, profile, user, loading, role, isGuest, isBlocked } =
    useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark lg" />
          <h1>{isLogin ? 'Welcome back' : 'Create account'}</h1>
          <p>{isLogin ? 'Sign in to continue learning' : 'Sign up with email or Google'}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

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
      </div>
    </div>
  );
}

function redirectByRole(role, navigate) {
  if (isAdminRole(role)) navigate('/portal', { replace: true });
  else if (isGuestRole(role)) navigate('/app/home', { replace: true });
  else navigate('/app/home', { replace: true });
}
