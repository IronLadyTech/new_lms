/**
 * Super-admin user management — delete accounts via Cloud Functions.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/config';

function call(name, data) {
  if (!functions) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  return httpsCallable(functions, name)(data);
}

export function isUserAdminAvailable() {
  return isFirebaseConfigured();
}

export async function deleteUserAccount(userId) {
  const { data } = await call('adminDeleteUser', { userId });
  return data;
}
