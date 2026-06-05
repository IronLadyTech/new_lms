import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Only initialize Firebase when real credentials are present. Calling getAuth()
// with an empty apiKey throws (auth/invalid-api-key) and would crash the whole
// app at import time, leaving a blank page. When not configured we export null
// stubs so the UI can render the setup banner instead.
let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;

if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Force long-polling auto-detect: avoids cases where the streaming connection
  // stalls behind some networks/proxies, which can make reads hang. Reliable
  // in-memory cache keeps the app fast without the cross-tab lock issues that
  // the persistent multi-tab cache can hit.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
}

export { app, auth, db, storage, googleProvider };

export const isFirebaseConfigured = () => configured;
