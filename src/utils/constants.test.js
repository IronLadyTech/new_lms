import { describe, it, expect } from 'vitest';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from './constants';

/**
 * This check promotes an account to superadmin from the auth token alone, so a
 * loose match here is a privilege-escalation bug.
 */

describe('isSuperAdminEmail', () => {
  it('matches the owner address', () => {
    expect(isSuperAdminEmail(SUPER_ADMIN_EMAIL)).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isSuperAdminEmail(SUPER_ADMIN_EMAIL.toUpperCase())).toBe(true);
    expect(isSuperAdminEmail(`  ${SUPER_ADMIN_EMAIL}  `)).toBe(true);
  });

  it('rejects look-alike addresses', () => {
    expect(isSuperAdminEmail('ironladytech@gmail.com.attacker.com')).toBe(false);
    expect(isSuperAdminEmail('xironladytech@gmail.com')).toBe(false);
    expect(isSuperAdminEmail('ironladytech@gmail.co')).toBe(false);
    expect(isSuperAdminEmail('ironladytech+admin@gmail.com')).toBe(false);
  });

  it('rejects non-strings without throwing', () => {
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
    expect(isSuperAdminEmail('')).toBe(false);
    expect(isSuperAdminEmail(123)).toBe(false);
    expect(isSuperAdminEmail({ toLowerCase: () => SUPER_ADMIN_EMAIL })).toBe(false);
  });
});
