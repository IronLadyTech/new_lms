/**
 * Super-admin storage management — calls Cloud Functions for bucket operations.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/config';

function call(name, data) {
  if (!functions) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  return httpsCallable(functions, name)(data);
}

export function isStorageAdminAvailable() {
  return isFirebaseConfigured();
}

export async function getStorageOverview() {
  const { data } = await call('storageGetOverview');
  return data;
}

export async function scanStorageBucket() {
  const { data } = await call('storageScanBucket');
  return data;
}

export async function listStorageObjects(filters = {}) {
  const { data } = await call('storageListObjects', filters);
  return data;
}

export async function deleteStorageObjects(paths) {
  const { data } = await call('storageDeleteObjects', { paths });
  return data;
}

export async function cleanOrphanFiles() {
  const { data } = await call('storageCleanOrphans');
  return data;
}

export async function deleteUserStorage(userId) {
  const { data } = await call('storageDeleteUserStorage', { userId });
  return data;
}

export async function resetUserStorage(userId) {
  const { data } = await call('storageResetUserStorage', { userId });
  return data;
}
