import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * Point Firestore at the local emulator instead of the live project.
 *
 * Set only by the write-path tests, so they can exercise the real service code
 * against a throwaway database. Never true in a production build: the flag has
 * to be passed in explicitly, and a build without it cannot reach the emulator.
 */
const useEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR === 'true';

// Only initialize Firebase when real credentials are present. Calling getAuth()
// with an empty apiKey throws (auth/invalid-api-key) and would crash the whole
// app at import time, leaving a blank page. When not configured we export null
// stubs so the UI can render the setup banner instead.
let app = null;
let auth = null;
let db = null;
let storage = null;
let functions = null;
let messaging = null;
let googleProvider = null;

if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  // Force long-polling auto-detect: avoids cases where the streaming connection
  // stalls behind some networks/proxies, which can make reads hang. Reliable
  // in-memory cache keeps the app fast without the cross-tab lock issues that
  // the persistent multi-tab cache can hit.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  if (useEmulator) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  storage = getStorage(app);
  functions = getFunctions(app);
  googleProvider = new GoogleAuthProvider();

  const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
  if (appCheckSiteKey) {
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN) {
      // eslint-disable-next-line no-underscore-dangle
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  // Messaging is only supported in secure contexts (HTTPS / localhost).
  // getMessaging() throws in unsupported environments, so we guard it.
  isSupported().then((supported) => {
    if (supported) messaging = getMessaging(app);
  });
}

export { app, auth, db, storage, functions, messaging, googleProvider };

export const isFirebaseConfigured = () => configured;
