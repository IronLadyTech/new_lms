import { getToken, onMessage } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { saveFcmToken } from './userService';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Assembled once on first initNotifications call and reused.
let messagingInstance = null;
// Guard so repeated auth events don't register duplicate onMessage handlers
// or run the whole init flow more than once per page load.
let initPromise = null;
let foregroundHandlerBound = false;

// Call this once after a real user signs in.
// Requests notification permission, gets FCM token, saves it to Firestore.
// Idempotent: repeated calls reuse the first in-flight/completed init.
export async function initNotifications(uid) {
  if (!uid) return undefined;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return undefined;
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY is not set — push notifications disabled');
    return undefined;
  }

  if (!initPromise) {
    initPromise = doInit(uid).catch((err) => {
      // Non-fatal — notification failures must never break the app. Reset so a
      // later sign-in can retry (e.g. after the user grants permission).
      console.warn('FCM init failed:', err.message);
      initPromise = null;
    });
  }
  return initPromise;
}

async function doInit(uid) {
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  // Wait until the SW is active; getToken can fail intermittently otherwise.
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  // Lazily import messaging so it doesn't break in unsupported browsers
  const { getMessaging } = await import('firebase/messaging');
  const { app } = await import('../firebase/config');
  if (!app) return;

  messagingInstance = messagingInstance || getMessaging(app);

  const token = await getToken(messagingInstance, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    await saveFcmToken(uid, token);
  }

  // Show foreground notifications as native browser notifications. Bind once.
  if (!foregroundHandlerBound) {
    foregroundHandlerBound = true;
    onMessage(messagingInstance, (payload) => {
      const { title = 'LMS', body = '' } = payload.notification || {};
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/logo.png' });
      }
    });
  }
}

// ── CX-triggered reminders ────────────────────────────────────

export async function sendTaskReminder(userId, taskId) {
  const fn = httpsCallable(functions, 'sendTaskReminder');
  const { data } = await fn({ userId, taskId });
  return data;
}

export async function sendSessionReminder(batchId, message) {
  const fn = httpsCallable(functions, 'sendSessionReminder');
  const { data } = await fn({ batchId, message });
  return data;
}
