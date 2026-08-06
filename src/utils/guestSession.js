import { ROLES } from './roles';

export const GUEST_SESSION_KEY = 'ilms_guest_session';

export const GUEST_USER = {
  uid: 'guest',
  email: null,
  displayName: 'Guest',
  isGuest: true,
};

export const GUEST_PROFILE = {
  id: 'guest',
  displayName: 'Guest',
  email: null,
  role: ROLES.GUEST,
  enrolledCourses: [],
  streak: 0,
};

export function isGuestSessionActive() {
  try {
    return sessionStorage.getItem(GUEST_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function startGuestSession() {
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, '1');
  } catch {
    /* private mode — guest flag may not persist */
  }
}

export function clearGuestSession() {
  try {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
