// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GUEST_SESSION_KEY,
  GUEST_PROFILE,
  GUEST_USER,
  isGuestSessionActive,
  startGuestSession,
  clearGuestSession,
} from './guestSession';
import { ROLES } from './roles';

describe('guest session', () => {
  beforeEach(() => sessionStorage.clear());

  it('is inactive until explicitly started', () => {
    expect(isGuestSessionActive()).toBe(false);
  });

  it('starts and clears', () => {
    startGuestSession();
    expect(isGuestSessionActive()).toBe(true);
    clearGuestSession();
    expect(isGuestSessionActive()).toBe(false);
  });

  it('treats any other stored value as inactive', () => {
    sessionStorage.setItem(GUEST_SESSION_KEY, 'true');
    expect(isGuestSessionActive()).toBe(false);
    sessionStorage.setItem(GUEST_SESSION_KEY, '0');
    expect(isGuestSessionActive()).toBe(false);
  });

  it('uses sessionStorage, so the session dies with the tab', () => {
    startGuestSession();
    expect(sessionStorage.getItem(GUEST_SESSION_KEY)).toBe('1');
    expect(localStorage.getItem(GUEST_SESSION_KEY)).toBeNull();
  });

  it('gives the guest the guest role and no enrolments', () => {
    expect(GUEST_PROFILE.role).toBe(ROLES.GUEST);
    expect(GUEST_PROFILE.enrolledCourses).toEqual([]);
    expect(GUEST_USER.isGuest).toBe(true);
    expect(GUEST_USER.email).toBeNull();
  });
});
