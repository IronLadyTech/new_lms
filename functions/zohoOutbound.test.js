import { describe, it, expect } from 'vitest';
import zoho from './zoho.js';

const { profileToLeadFields } = zoho;

/**
 * What the LMS writes back to a Zoho lead.
 *
 * This payload was silently failing on every user: it named fields that did not
 * exist on the Iron Lady Leads layout, and Zoho rejects the whole upsert on one
 * unknown field. The log said only "invalid data" because the details naming
 * the field were being thrown away.
 *
 * Two of the fields were worse than merely absent, and those are what these
 * tests hold down.
 */

const PROFILE = {
  email: 'learner@example.com',
  displayName: 'A Learner',
  enrolledCourses: ['100bm-q1'],
  role: 'student',
  blocked: false,
  program: '100bm',
  accessTier: 'full',
  paymentStatus: 'paid',
};

describe('outbound lead payload · what must never be sent', () => {
  it('does not write entitlements back to Zoho', () => {
    /*
     * Zoho owns entitlements. Lead Status is where CX records what somebody
     * paid for; the LMS derives access from it. Writing a flat payment status
     * back means the next pull reads the LMS's own value and it beats Lead
     * Status — so a stale "paid" becomes permanent and re-syncing cannot fix
     * it. That is exactly the state one learner was stuck in.
     */
    const payload = profileToLeadFields('uid-1', PROFILE);
    expect(payload).not.toHaveProperty('LMS_Payment_Status');
    expect(payload).not.toHaveProperty('LMS_Access_Tier');
    expect(payload).not.toHaveProperty('LMS_Program');
  });

  it('does not touch Description', () => {
    // Description holds the brief CX reads. It used to be overwritten with the
    // Firebase UID on every sync, before Firebase_UID existed as a field.
    const payload = profileToLeadFields('uid-1', PROFILE);
    expect(payload).not.toHaveProperty('Description');
  });

  it('sends no field carrying a payment tier under any name', () => {
    const serialised = JSON.stringify(profileToLeadFields('uid-1', PROFILE));
    for (const leak of ['paid', 'register', 'full', 'unpaid']) {
      expect(serialised, leak).not.toContain(leak);
    }
  });
});

describe('outbound lead payload · what it does send', () => {
  it('carries the identity fields that link a lead to an LMS account', () => {
    const payload = profileToLeadFields('uid-1', PROFILE);
    expect(payload.Firebase_UID).toBe('uid-1');
    expect(payload.Email).toBe('learner@example.com');
    expect(payload.Last_Name).toBe('A Learner');
  });

  it('sends only fields that exist on the Iron Lady Leads layout', () => {
    /*
     * The allow-list is the layout as it actually stands, read back from a live
     * lead. Adding a key here without creating the field in Zoho breaks the
     * upsert for every user, which is the failure this file exists to prevent.
     */
    const ON_LAYOUT = new Set([
      'Email',
      'Last_Name',
      'Enrolled_Courses',
      'LMS_Role',
      'LMS_Blocked',
      'Firebase_UID',
    ]);
    for (const key of Object.keys(profileToLeadFields('uid-1', PROFILE))) {
      expect(ON_LAYOUT.has(key), `${key} is not on the Leads layout`).toBe(true);
    }
  });

  it('falls back to the email local part when there is no display name', () => {
    const payload = profileToLeadFields('uid-1', { ...PROFILE, displayName: '' });
    expect(payload.Last_Name).toBe('learner');
  });

  it('survives a profile with nothing on it', () => {
    expect(() => profileToLeadFields('uid-1', {})).not.toThrow();
  });
});
