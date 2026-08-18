import { describe, it, expect } from 'vitest';
import provisioning from './zohoProvisioning.js';

const { matchesStoredCredential } = provisioning;

/*
 * IL_Users holds the learner's credential twice while old Moodle is live:
 *
 *   LMS_Password — written by this LMS (and mirrored into Password)
 *   Password     — written by this LMS, and by Moodle when a learner changes
 *                  it there
 *
 * Because Moodle writes only the second field, the two disagree until the next
 * sync. Preferring LMS_Password meant a stale value won and the learner was
 * told their password did not match.
 */
describe('matchesStoredCredential', () => {
  it('accepts the password when both fields agree', () => {
    const user = { LMS_Password: 'Same123-xX', Password: 'Same123-xX' };
    expect(matchesStoredCredential(user, 'Same123-xX')).toBe(true);
  });

  it('accepts a password changed in Moodle, which lands in Password only', () => {
    // The regression: LMS_Password is stale, Password is current.
    const user = { LMS_Password: 'Old123-xX', Password: 'NewFromMoodle-xX' };
    expect(matchesStoredCredential(user, 'NewFromMoodle-xX')).toBe(true);
  });

  it('accepts a password changed here, which lands in LMS_Password first', () => {
    const user = { LMS_Password: 'NewFromLms-xX', Password: 'Old123-xX' };
    expect(matchesStoredCredential(user, 'NewFromLms-xX')).toBe(true);
  });

  it('still rejects a password neither field holds', () => {
    const user = { LMS_Password: 'Old123-xX', Password: 'NewFromMoodle-xX' };
    expect(matchesStoredCredential(user, 'Guess123-xX')).toBe(false);
  });

  it('rejects an empty attempt even when a field is empty too', () => {
    // '' must never match a blank field and let somebody in without a password.
    expect(matchesStoredCredential({ LMS_Password: '', Password: '' }, '')).toBe(false);
    expect(matchesStoredCredential({ LMS_Password: 'Set123-xX' }, '')).toBe(false);
    expect(matchesStoredCredential({ LMS_Password: '', Password: 'Set123-xX' }, '   ')).toBe(false);
  });

  it('ignores surrounding whitespace on the stored value', () => {
    expect(matchesStoredCredential({ Password: '  Same123-xX  ' }, 'Same123-xX')).toBe(true);
  });

  it('rejects when the record has no credential at all', () => {
    expect(matchesStoredCredential({}, 'Any123-xX')).toBe(false);
    expect(matchesStoredCredential(null, 'Any123-xX')).toBe(false);
  });
});
