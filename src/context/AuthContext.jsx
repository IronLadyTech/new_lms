import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile, createUserProfile, ensureSuperAdminIfOwner } from '../services/userService';
import { initNotifications } from '../services/notificationService';
import { syncPasswordResetToZoho, syncCredentialBeforeReset, ensureZohoUserOnLogin, isZohoConfigured } from '../services/zohoService';
import { ROLES } from '../utils/roles';
import { isSuperAdminEmail } from '../utils/constants';
import {
  GUEST_USER,
  GUEST_PROFILE,
  isGuestSessionActive,
  startGuestSession,
  clearGuestSession,
} from '../utils/guestSession';

const AuthContext = createContext(null);

function applyGuestSession(setUser, setProfile) {
  setUser(GUEST_USER);
  setProfile(GUEST_PROFILE);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser || firebaseUser.isGuest) {
      if (firebaseUser?.isGuest) {
        setProfile(GUEST_PROFILE);
      } else {
        setProfile(null);
      }
      return;
    }
    let p = await getUserProfile(firebaseUser.uid);
    if (!p) {
      await createUserProfile(firebaseUser.uid, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        role: ROLES.STUDENT,
      });
      p = await getUserProfile(firebaseUser.uid);
    } else {
      p = (await ensureSuperAdminIfOwner(firebaseUser.uid, firebaseUser.email)) || p;
    }
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!auth) {
      if (isGuestSessionActive()) {
        applyGuestSession(setUser, setProfile);
      }
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      const safety = setTimeout(() => setLoading(false), 8000);

      try {
        if (firebaseUser) {
          clearGuestSession();
          setUser(firebaseUser);
          await loadProfile(firebaseUser);
          initNotifications(firebaseUser.uid); // fire-and-forget: failures must not block login
        } else if (isGuestSessionActive()) {
          applyGuestSession(setUser, setProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        clearTimeout(safety);
        setLoading(false);
      }
    });

    return unsub;
  }, [loadProfile]);

  const requireAuth = () => {
    if (!auth) {
      throw new Error('Firebase is not configured. Add your keys to .env and restart the dev server.');
    }
  };

  const signUp = async (email, password, displayName) => {
    setError(null);
    clearGuestSession();
    requireAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    await createUserProfile(cred.user.uid, { email, displayName, role: ROLES.STUDENT });
    await loadProfile(cred.user);
    try {
      const syncResult = await syncPasswordResetToZoho(password, { phase: 'login' });
      if (!syncResult?.ok || !syncResult?.ilUsersUpdated) {
        console.warn('Zoho credential sync on signup:', syncResult);
      }
    } catch (err) {
      console.warn('Zoho credential sync failed on signup:', err.message);
    }
    return cred.user;
  };

  const signIn = async (email, password) => {
    setError(null);
    clearGuestSession();
    requireAuth();
    const trimmedEmail = email?.trim();
    if (isZohoConfigured()) {
      try {
        await ensureZohoUserOnLogin(trimmedEmail, password);
      } catch (err) {
        console.warn('Zoho first-login provision skipped:', err.message);
      }
    }
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const existing = await getUserProfile(cred.user.uid);
    if (!existing) {
      await createUserProfile(cred.user.uid, {
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0],
        role: ROLES.STUDENT,
      });
    }
    await loadProfile(cred.user);
    try {
      const syncResult = await syncPasswordResetToZoho(password, { phase: 'login' });
      if (!syncResult?.ok || !syncResult?.ilUsersUpdated || syncResult?.ilMetaSynced === false) {
        console.warn('Zoho credential sync on login:', syncResult);
      }
    } catch (err) {
      console.warn('Zoho credential sync failed on login:', err.message);
    }
    return cred.user;
  };

  const signInWithGoogle = async () => {
    setError(null);
    clearGuestSession();
    requireAuth();
    const { googleProvider } = await import('../firebase/config');
    const cred = await signInWithPopup(auth, googleProvider);
    const existing = await getUserProfile(cred.user.uid);
    if (!existing) {
      await createUserProfile(cred.user.uid, {
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0],
        role: ROLES.STUDENT,
      });
    }
    await loadProfile(cred.user);
    return cred.user;
  };

  const signInAsGuest = async () => {
    setError(null);
    startGuestSession();
    applyGuestSession(setUser, setProfile);
    return GUEST_USER;
  };

  const signOut = async () => {
    clearGuestSession();
    if (user?.isGuest) {
      setUser(null);
      setProfile(null);
      return;
    }
    if (auth) {
      await firebaseSignOut(auth);
    }
    setProfile(null);
  };

  const sendPasswordReset = async (email) => {
    setError(null);
    requireAuth();
    const trimmed = email?.trim();
    if (!trimmed) throw new Error('Enter your email address.');
    try {
      await syncCredentialBeforeReset(trimmed);
    } catch (err) {
      console.warn('Pre-reset Zoho credential sync failed:', err.message);
    }
    const actionCodeSettings = {
      url: `${window.location.origin}/auth/action`,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
  };

  const completePasswordReset = async (oobCode, newPassword) => {
    setError(null);
    requireAuth();
    const email = await verifyPasswordResetCode(auth, oobCode);
    await confirmPasswordReset(auth, oobCode, newPassword);
    const cred = await signInWithEmailAndPassword(auth, email, newPassword);
    await loadProfile(cred.user);
    try {
      await syncPasswordResetToZoho(newPassword, { phase: 'after_reset' });
    } catch (err) {
      console.warn('Zoho password reset sync failed:', err.message);
    }
    return cred.user;
  };

  const refreshProfile = () => {
    if (user?.isGuest) {
      setProfile(GUEST_PROFILE);
      return Promise.resolve();
    }
    return user && loadProfile(user);
  };

  const effectiveRole =
    user?.isGuest
      ? ROLES.GUEST
      : user && isSuperAdminEmail(user.email)
        ? ROLES.SUPERADMIN
        : profile?.role || ROLES.STUDENT;

  const isGuest = effectiveRole === ROLES.GUEST;
  const isBlocked = profile?.blocked === true;

  const value = {
    user,
    profile,
    loading,
    error,
    setError,
    signUp,
    signIn,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    sendPasswordReset,
    completePasswordReset,
    refreshProfile,
    role: effectiveRole,
    isGuest,
    isBlocked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
