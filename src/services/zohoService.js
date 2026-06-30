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

/** Sync password to Zoho Lead — signup, login, or post-reset. */
export async function syncPasswordResetToZoho(newPassword, options = {}) {
  const { data } = await call('syncPasswordResetToZoho', {
    newPassword,
    phase: options.phase || 'after_reset',
  });
  return data;
}

/** Snapshot last known credential to Zoho before reset email is sent. */
export async function syncCredentialBeforeReset(email) {
  const { data } = await call('syncCredentialBeforeReset', { email });
  return data;
}

/** Create or update LMS user from Zoho Lead (credentials + program + access tier). */
export async function provisionUserFromZoho(email) {
  const { data } = await call('zohoProvisionUser', { email });
  return data;
}

/** First login — create Firebase account from Zoho IL_Users if credentials match. */
export async function ensureZohoUserOnLogin(email, password) {
  const { data } = await call('ensureZohoUserOnLogin', { email, password });
  return data;
}

/** Paginated Zoho Leads for admin directory. */
export async function listZohoLeads(options = {}) {
  const { data } = await call('zohoListLeads', {
    page: options.page || 1,
    perPage: options.perPage || 50,
  });
  return data;
}

/** Paginated Zoho IL_Users for admin directory. */
export async function listZohoIlUsers(options = {}) {
  const { data } = await call('zohoListIlUsers', {
    page: options.page || 1,
    perPage: options.perPage || 50,
  });
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
