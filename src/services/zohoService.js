/**
 * Zoho CRM parallel sync — mirrors Firebase user/enrollment data.
 * All API calls go through Firebase Cloud Functions (secrets stay server-side).
 */

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/config';

function call(name, data) {
  if (!functions) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  return httpsCallable(functions, name)(data);
}

/** True when Firebase is ready — Zoho runs on Cloud Functions when secrets are deployed. */
export function isZohoConfigured() {
  return isFirebaseConfigured();
}

export async function testZohoConnection() {
  try {
    const { data } = await call('zohoTestConnection');
    return data;
  } catch (err) {
    return { ok: false, reason: err.message || 'Connection test failed' };
  }
}

export async function syncAllUsersToZoho() {
  const { data } = await call('zohoSyncAllUsers');
  return data;
}

export async function syncUserToZohoById(userId) {
  const { data } = await call('zohoSyncUser', { userId });
  return data;
}

/** @deprecated Sync is automatic via Firestore triggers. Kept for compatibility. */
export async function syncUserToZoho() {
  return { synced: false, reason: 'Automatic sync via Cloud Functions' };
}

/** @deprecated Activity notes are automatic via Firestore triggers. */
export async function logActivityToZoho() {
  return { synced: false, reason: 'Automatic sync via Cloud Functions' };
}
