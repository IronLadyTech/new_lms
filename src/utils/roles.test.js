import { describe, it, expect } from 'vitest';
import {
  ROLES,
  hasMinRole,
  isAdminRole,
  isModeratorOnly,
  isFullAdmin,
  isGuestRole,
  getRoleLabel,
} from './roles';

/**
 * Role checks gate every protected route. The tests below are written from the
 * attacker's side — what a role must NOT be able to reach — because a
 * permissive bug here is invisible in normal use.
 */

describe('hasMinRole', () => {
  it('grants access at exactly the required level', () => {
    expect(hasMinRole(ROLES.MODERATOR, ROLES.MODERATOR)).toBe(true);
    expect(hasMinRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  it('grants access above the required level', () => {
    expect(hasMinRole(ROLES.SUPERADMIN, ROLES.MODERATOR)).toBe(true);
    expect(hasMinRole(ROLES.ADMIN, ROLES.MODERATOR)).toBe(true);
  });

  it('denies access below the required level', () => {
    expect(hasMinRole(ROLES.STUDENT, ROLES.MODERATOR)).toBe(false);
    expect(hasMinRole(ROLES.MODERATOR, ROLES.ADMIN)).toBe(false);
    expect(hasMinRole(ROLES.ADMIN, ROLES.SUPERADMIN)).toBe(false);
  });

  it('never lets a guest past a staff gate', () => {
    expect(hasMinRole(ROLES.GUEST, ROLES.MODERATOR)).toBe(false);
    expect(hasMinRole(ROLES.GUEST, ROLES.ADMIN)).toBe(false);
    expect(hasMinRole(ROLES.GUEST, ROLES.SUPERADMIN)).toBe(false);
    expect(hasMinRole(ROLES.GUEST, ROLES.STUDENT)).toBe(false);
  });

  it('denies an unknown required role rather than guessing', () => {
    expect(hasMinRole(ROLES.SUPERADMIN, 'not-a-role')).toBe(false);
  });

  it('treats an unknown user role as a plain learner, never as staff', () => {
    // Documents current behaviour: an unrecognised role falls back to learner
    // level. It must never clear a staff gate.
    expect(hasMinRole('typo-role', ROLES.STUDENT)).toBe(true);
    expect(hasMinRole('typo-role', ROLES.MODERATOR)).toBe(false);
    expect(hasMinRole(undefined, ROLES.ADMIN)).toBe(false);
    expect(hasMinRole(null, ROLES.SUPERADMIN)).toBe(false);
  });
});

describe('isAdminRole', () => {
  it('accepts every staff role', () => {
    expect(isAdminRole(ROLES.MODERATOR)).toBe(true);
    expect(isAdminRole(ROLES.ADMIN)).toBe(true);
    expect(isAdminRole(ROLES.SUPERADMIN)).toBe(true);
  });

  it('rejects learners, guests, and unknowns', () => {
    expect(isAdminRole(ROLES.STUDENT)).toBe(false);
    expect(isAdminRole(ROLES.GUEST)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole('admin ')).toBe(false); // whitespace is not a role
  });
});

describe('isFullAdmin', () => {
  it('excludes moderators — they are staff but not admins', () => {
    expect(isFullAdmin(ROLES.MODERATOR)).toBe(false);
    expect(isFullAdmin(ROLES.ADMIN)).toBe(true);
    expect(isFullAdmin(ROLES.SUPERADMIN)).toBe(true);
  });

  it('rejects learners and guests', () => {
    expect(isFullAdmin(ROLES.STUDENT)).toBe(false);
    expect(isFullAdmin(ROLES.GUEST)).toBe(false);
  });
});

describe('isModeratorOnly / isGuestRole', () => {
  it('matches only the exact role', () => {
    expect(isModeratorOnly(ROLES.MODERATOR)).toBe(true);
    expect(isModeratorOnly(ROLES.ADMIN)).toBe(false);
    expect(isGuestRole(ROLES.GUEST)).toBe(true);
    expect(isGuestRole(ROLES.STUDENT)).toBe(false);
  });
});

describe('getRoleLabel', () => {
  it('shows learners as "User", never the internal name', () => {
    expect(getRoleLabel(ROLES.STUDENT)).toBe('User');
    expect(getRoleLabel(undefined)).toBe('User');
  });

  it('spells out staff roles for the admin UI', () => {
    expect(getRoleLabel(ROLES.MODERATOR)).toBe('Customer Expression');
    expect(getRoleLabel(ROLES.SUPERADMIN)).toBe('Super Admin');
    expect(getRoleLabel(ROLES.ADMIN)).toBe('Admin');
    expect(getRoleLabel(ROLES.GUEST)).toBe('Guest');
  });

  it('passes an unrecognised role through rather than showing nothing', () => {
    expect(getRoleLabel('auditor')).toBe('auditor');
  });
});
