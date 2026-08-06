/**
 * Zoho CRM parallel sync — mirrors Firebase user/enrollment data.
 * All API calls go through Firebase Cloud Functions (secrets stay server-side).
 */

import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, functions, isFirebaseConfigured } from '../firebase/config';

let loginFunctions = null;

function getLoginFunctions() {
  if (!app) return null;
  if (!loginFunctions) {
    loginFunctions = getFunctions(app, 'asia-south1');
  }
  return loginFunctions;
}

function call(name, data) {
  if (!functions) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  return httpsCallable(functions, name)(data);
}

function formatCallableError(err, fallback) {
  const code = err?.code || '';
  if (code === 'functions/deadline-exceeded') {
    return 'The server timed out. For bulk sync, try again after deploying the latest functions, or sync users one at a time.';
  }
  if (code === 'functions/internal' || code === 'functions/unavailable') {
    return 'Cloud Function failed or is unavailable. Check Firebase Functions logs (zohoSyncAllUsers) and redeploy functions if needed.';
  }
  if (code === 'functions/permission-denied') {
    return 'Admin access required for this action.';
  }
  return err?.message || fallback;
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
  try {
    const { data } = await call('zohoSyncAllUsers');
    return data;
  } catch (err) {
    throw new Error(formatCallableError(err, 'Bulk sync failed'));
  }
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
  const regional = getLoginFunctions();
  if (!regional) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  const { data } = await httpsCallable(regional, 'ensureZohoUserOnLogin')({ email, password });
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

/**
 * Batch mapping PREVIEW — read-only dry run.
 * Reports which LMS batches WOULD be created from Zoho IL_Users.
 * Writes nothing to Zoho or Firestore.
 */
export async function previewZohoBatches(options = {}) {
  try {
    const { data } = await call('zohoBatchSyncPreview', {
      maxPages: options.maxPages || 10,
    });
    return data;
  } catch (err) {
    throw new Error(formatCallableError(err, 'Batch preview failed'));
  }
}

export async function applyZohoBatch(options = {}) {
  try {
    const { data } = await call('zohoBatchSyncApply', {
      program: options.program,
      rawBatch: options.rawBatch,
      startDate: options.startDate,
      endDate: options.endDate,
      dryRun: options.dryRun !== false,
      maxPages: options.maxPages || 50,
    });
    return data;
  } catch (err) {
    throw new Error(formatCallableError(err, 'Batch apply failed'));
  }
}

/** Sync one learner's LMS batch from Zoho (after batch change in CRM). */
export async function syncUserBatchFromZoho(email, { dryRun = false, provisionIfMissing = true } = {}) {
  try {
    const { data } = await call('zohoSyncUserBatch', {
      email: email?.trim(),
      dryRun,
      provisionIfMissing,
    });
    return data;
  } catch (err) {
    throw new Error(formatCallableError(err, 'Batch sync failed'));
  }
}

/** Paginated Zoho IL_Users for admin directory. */
export async function listZohoIlUsers(options = {}) {
  const { data } = await call('zohoListIlUsers', {
    page: options.page || 1,
    perPage: options.perPage || 50,
  });
  return data;
}

/** Paginated Zoho IL_Registration — cohort/batch tracker in CRM. */
export async function listZohoIlRegistration(options = {}) {
  const { data } = await call('zohoListIlRegistration', {
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
