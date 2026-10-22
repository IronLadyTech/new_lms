/*
 * Stitch login preview — /auth/login-next
 * Desktop: equal 50/50 — video left, form right (contain, no caption crop).
 * Mobile: full-screen reel + Skip. Fonts match home-next (Inter + Gemunu Libre).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isGuestRole, isModeratorOnly } from '../../utils/roles';
import { IRON_LADY_CONTACT_EMAIL } from '../../utils/constants';
import '../../styles/stitchLogin.css';

const HERO_DESKTOP_SRC = '/hero-4x5-desktop.mp4';
const HERO_MOBILE_SRC = '/hero-4x5-mobile.mp4';
const MOBILE_MQ = '(max-width: 900px)';
const MOBILE_INTRO_SEEN_KEY = 'il_login_next_intro_seen';
/** Off by default — paid learners provision via Zoho email/password, not Google. */
const showGoogleAuth = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

function hasSeenMobileIntro() {
  try {
    return sessionStorage.getItem(MOBILE_INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markMobileIntroSeen() {
  try {
    sessionStorage.setItem(MOBILE_INTRO_SEEN_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
    };
  }, []);

  return isMobile;
}

export default function LoginNext() {
  const {
    signIn,
    signInAsGuest,
    signInWithGoogle,
    sendPasswordReset,
    error,
    setError,
    profile,
    user,
    loading,
    role,
    isGuest,
    isBlocked,
  } = useAuth();
  const navigate = useNavigate();
  const desktopVideoRef = useRef(null);
  const desktopBleedRef = useRef(null);
  const introVideoRef = useRef(null);
  const isMobile = useIsMobile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mobileIntroDone, setMobileIntroDone] = useState(() => hasSeenMobileIntro());

  const showMobileIntro = isMobile && !mobileIntroDone;

  useEffect(() => {
    if (!loading && user && !isGuest && !isBlocked && (profile || role)) {
      redirectByRole(profile?.role || role, navigate);
    }
  }, [loading, user, profile, role, isGuest, isBlocked, navigate]);

  /* Reduced motion: skip mobile intro */
  useEffect(() => {
    if (!isMobile) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const skipIfNeeded = () => {
      if (mq.matches) {
        markMobileIntroSeen();
        setMobileIntroDone(true);
      }
    };
    skipIfNeeded();
    mq.addEventListener('change', skipIfNeeded);
    return () => mq.removeEventListener('change', skipIfNeeded);
  }, [isMobile]);

  /* Desktop: clear intro only when resizing up; returning mobile reuses session flag */
  useEffect(() => {
    if (!isMobile) return undefined;
    const onPageShow = (e) => {
      if (e.persisted && hasSeenMobileIntro()) setMobileIntroDone(true);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [isMobile]);

  /* Desktop ambient loop — sharp contain + blurred bleed fill (50% panel, no crop, no black bars) */
  useEffect(() => {
    const video = desktopVideoRef.current;
    const bleed = desktopBleedRef.current;
    if (!video || isMobile) {
      video?.pause();
      bleed?.pause();
      return undefined;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const syncBleed = () => {
      if (!bleed) return;
      if (Math.abs(bleed.currentTime - video.currentTime) > 0.25) {
        bleed.currentTime = video.currentTime;
      }
    };
    const tryPlayEl = (el) => {
      if (!el) return;
      el.muted = true;
      el.defaultMuted = true;
      el.loop = true;
      el.playsInline = true;
      if (reduced) {
        el.pause();
        return;
      }
      const playPromise = el.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };
    const start = () => {
      tryPlayEl(video);
      tryPlayEl(bleed);
      syncBleed();
    };
    const onPlay = () => tryPlayEl(bleed);
    start();
    video.addEventListener('loadeddata', start);
    video.addEventListener('timeupdate', syncBleed);
    video.addEventListener('play', onPlay);
    video.addEventListener('seeked', syncBleed);
    return () => {
      video.removeEventListener('loadeddata', start);
      video.removeEventListener('timeupdate', syncBleed);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('seeked', syncBleed);
      video.pause();
      bleed?.pause();
    };
  }, [isMobile]);

  /* Mobile intro — 1:1 asset, loop until Skip */
  useEffect(() => {
    if (!showMobileIntro) return undefined;
    const video = introVideoRef.current;
    if (!video) return undefined;

    let cancelled = false;

    const tryPlay = () => {
      if (cancelled) return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.loop = true;
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };

    tryPlay();
    video.addEventListener('canplay', tryPlay);
    video.addEventListener('loadeddata', tryPlay);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      video.removeEventListener('canplay', tryPlay);
      video.removeEventListener('loadeddata', tryPlay);
      document.removeEventListener('visibilitychange', onVisibility);
      video.pause();
    };
  }, [showMobileIntro]);

  const handleSkipIntro = () => {
    const video = introVideoRef.current;
    if (video) {
      video.pause();
      video.loop = false;
    }
    markMobileIntroSeen();
    setMobileIntroDone(true);
  };
  if (loading || (user && profile && !isGuest && !isBlocked)) {
    return (
      <div className="stitch-login" aria-busy="true">
        <div className="sl-loading">
          <div className="sl-spinner" role="status" aria-label="Loading" />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
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

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
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

  const shellClass = [
    'sl-shell',
    showMobileIntro ? 'is-mobile-intro' : '',
    isMobile && mobileIntroDone ? 'is-mobile-login' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="stitch-login">
      {/* Full-page blurred video — same tones as the side bars */}
      {!isMobile && (
        <video
          ref={desktopBleedRef}
          className="sl-page-bleed"
          src={HERO_DESKTOP_SRC}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      <main className={shellClass}>
        {/* Desktop — sharp 4:5 contain on left (captions intact) */}
        {!isMobile && (
          <div className="sl-visual-col" aria-hidden="true">
            <div className="sl-visual">
              <video
                ref={desktopVideoRef}
                className="sl-visual__video sl-visual__video--fit"
                src={HERO_DESKTOP_SRC}
                autoPlay
                muted
                playsInline
                loop
                preload="auto"
              />
            </div>
          </div>
        )}

        {/* Mobile — reel intro, full frame visible (no crop) */}
        {showMobileIntro && (
          <div className="sl-mobile-intro" role="dialog" aria-label="Promotional video">
            <video
              ref={introVideoRef}
              className="sl-mobile-intro__video"
              src={HERO_MOBILE_SRC}
              autoPlay
              muted
              playsInline
              loop
              preload="auto"
            />
            <button type="button" className="sl-skip" onClick={handleSkipIntro}>
              Skip
            </button>
          </div>
        )}

        <div className="sl-panel">
          <div className="sl-card">
            <div className="sl-card__inner">
              <div className="sl-brand">
                <img className="sl-brand__logo" src="/logo.png" alt="" />
                <span className="sl-brand__wordmark">Iron Lady</span>
              </div>

              <header className="sl-head">
                <h1 className="sl-head__title">
                  {forgotOpen ? 'Reset password' : 'Welcome back!'}
                </h1>
                <p className="sl-head__sub">
                  {forgotOpen
                    ? 'Enter your registered email and we will send a secure reset link.'
                    : 'Use the email from your Iron Lady enrolment to continue your curriculum.'}
                </p>
              </header>

              {error && (
                <div className="sl-alert sl-alert--error" role="alert">
                  {error}
                </div>
              )}
              {resetSent && (
                <div className="sl-alert sl-alert--success" role="status">
                  If an account exists for that email, a password reset link has been sent. Check
                  your inbox and spam folder.
                </div>
              )}

              {forgotOpen ? (
                <form className="sl-form" onSubmit={handleForgotPassword} noValidate>
                  <p className="sl-forgot-copy">
                    We will email a secure link to reset your password.
                  </p>
                  <div className="sl-field">
                    <label className="sl-label" htmlFor="sl-reset-email">
                      Email
                    </label>
                    <div className="sl-input-wrap">
                      <span className="sl-input-wrap__icon" aria-hidden>
                        <Mail size={20} strokeWidth={1.75} />
                      </span>
                      <input
                        id="sl-reset-email"
                        className="sl-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="sl-btn sl-btn--primary"
                    disabled={submitting}
                  >
                    <span>{submitting ? 'Sending…' : 'Send reset link'}</span>
                  </button>
                  <button
                    type="button"
                    className="sl-btn sl-btn--ghost"
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
                <form className="sl-form" onSubmit={handleSubmit} noValidate>
                  <div className="sl-field">
                    <label className="sl-label" htmlFor="sl-email">
                      Email
                    </label>
                    <div className="sl-input-wrap">
                      <span className="sl-input-wrap__icon" aria-hidden>
                        <Mail size={20} strokeWidth={1.75} />
                      </span>
                      <input
                        id="sl-email"
                        className="sl-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="sl-field">
                    <label className="sl-label" htmlFor="sl-password">
                      Password
                    </label>
                    <div className="sl-input-wrap">
                      <span className="sl-input-wrap__icon" aria-hidden>
                        <Lock size={20} strokeWidth={1.75} />
                      </span>
                      <input
                        id="sl-password"
                        className="sl-input sl-input--password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="sl-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff size={20} strokeWidth={1.75} aria-hidden />
                        ) : (
                          <Eye size={20} strokeWidth={1.75} aria-hidden />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="sl-forgot"
                      onClick={() => {
                        setForgotOpen(true);
                        setResetSent(false);
                        setError(null);
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="sl-btn sl-btn--primary"
                    disabled={submitting}
                  >
                    <span>{submitting ? 'Please wait…' : 'Log In'}</span>
                  </button>

                  {showGoogleAuth && (
                    <>
                      <div className="sl-divider" aria-hidden>
                        <div className="sl-divider__line" />
                        <span className="sl-divider__text">OR</span>
                        <div className="sl-divider__line" />
                      </div>

                      <button
                        type="button"
                        className="sl-btn sl-btn--google"
                        onClick={handleGoogle}
                        disabled={submitting}
                      >
                        <svg
                          className="sl-btn__google-icon"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          aria-hidden
                        >
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
                    </>
                  )}

                  <button
                    type="button"
                    className="sl-btn-tertiary"
                    onClick={handleGuest}
                    disabled={submitting}
                  >
                    Continue as guest
                  </button>
                </form>
              )}

              {!forgotOpen && (
                <footer className="sl-foot">
                  <p className="sl-foot__help">
                    Need help?{' '}
                    <a href={`mailto:${IRON_LADY_CONTACT_EMAIL}`}>
                      {IRON_LADY_CONTACT_EMAIL}
                    </a>
                  </p>
                </footer>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
