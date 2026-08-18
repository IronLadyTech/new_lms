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

/*
 * A learner changes their password in Moodle. Moodle writes it back to
 * IL_Users.Password and never touches Firebase, so Firebase still holds the
 * old one and sign-in fails. The caller then asks provisioning to sort it out.
 *
 * The account already exists, so this used to return success and change
 * nothing — the caller retried the same failing sign-in and the learner was
 * stuck with no way in.
 */
describe('provisionFromLoginCredentials — password changed in Moodle', () => {
  const ilUser = { LMS_Password: 'OldOne-xX', Password: 'NewFromMoodle-xX' };

  const run = async (typed, { authUser = { uid: 'u1' } } = {}) => {
    const calls = [];
    const result = await provisioning.provisionFromLoginCredentials(null, 'a@b.com', typed, {
      findIlUserRecord: async () => ilUser,
      getAuthUserByEmail: async () => authUser,
      updateAuthPassword: async (uid, password) => calls.push({ uid, password }),
    });
    return { result, calls };
  };

  it('brings Firebase into line with the password Moodle now has', async () => {
    const { result, calls } = await run('NewFromMoodle-xX');
    expect(result.ok).toBe(true);
    expect(result.passwordSynced).toBe(true);
    expect(calls).toEqual([{ uid: 'u1', password: 'NewFromMoodle-xX' }]);
  });

  it('refuses a password neither Zoho field holds, and changes nothing', async () => {
    const { result, calls } = await run('Guessing-xX');
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('leaves the create path alone when there is no account yet', async () => {
    const { calls } = await run('NewFromMoodle-xX', { authUser: null }).catch(() => ({ calls: [] }));
    // No existing user means provisioning creates one; it must not try to reset
    // a password on an account that does not exist.
    expect(calls).toEqual([]);
  });
});
