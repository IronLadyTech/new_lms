import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile, createUserProfile } from '../services/userService';
import { ROLES } from '../utils/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    let p = await getUserProfile(firebaseUser.uid);
    if (!p) {
      await createUserProfile(firebaseUser.uid, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role: ROLES.STUDENT,
      });
      p = await getUserProfile(firebaseUser.uid);
    }
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(true);
      try {
        await loadProfile(firebaseUser);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
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
    requireAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    await createUserProfile(cred.user.uid, { email, displayName, role: ROLES.STUDENT });
    await loadProfile(cred.user);
    return cred.user;
  };

  const signIn = async (email, password) => {
    setError(null);
    requireAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await loadProfile(cred.user);
    return cred.user;
  };

  const signInWithGoogle = async () => {
    setError(null);
    requireAuth();
    const { googleProvider } = await import('../firebase/config');
    const cred = await signInWithPopup(auth, googleProvider);
    const existing = await getUserProfile(cred.user.uid);
    if (!existing) {
      await createUserProfile(cred.user.uid, {
        email: cred.user.email,
        displayName: cred.user.displayName,
        role: ROLES.STUDENT,
      });
    }
    await loadProfile(cred.user);
    return cred.user;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const refreshProfile = () => user && loadProfile(user);

  const value = {
    user,
    profile,
    loading,
    error,
    setError,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
    role: profile?.role || ROLES.STUDENT,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
