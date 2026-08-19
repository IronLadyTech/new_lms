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

/**
 * Zoho DateTime formatting.
 *
 * The bulk sync failed on every learner with a credential, and the reason only
 * became visible once the upsert error carried Zoho's details:
 *
 *   invalid data ({"expected_data_type":"datetime",
 *                  "api_name":"LMS_Password_Updated_At"})
 *
 * Date.toISOString() produces milliseconds and a Z suffix; Zoho wants seconds
 * and an explicit offset. One wrong field rejects the whole record, so this
 * silently blocked the password sync for everybody.
 */
describe('zoho datetime', () => {
  const { toZohoDateTime, leadPasswordPayload } = zoho;

  it('drops milliseconds and writes an explicit offset', () => {
    expect(toZohoDateTime(new Date('2026-08-19T07:32:00.123Z'))).toBe('2026-08-19T07:32:00+00:00');
  });

  it('never emits the two things Zoho rejects', () => {
    const out = toZohoDateTime(new Date('2026-08-19T07:32:00.123Z'));
    expect(out).not.toMatch(/\.\d{3}/); // milliseconds
    expect(out).not.toMatch(/Z$/); // bare Zulu
  });

  it('takes a Date, an ISO string or epoch milliseconds alike', () => {
    const want = '2026-08-19T07:32:00+00:00';
    expect(toZohoDateTime(new Date('2026-08-19T07:32:00Z'))).toBe(want);
    expect(toZohoDateTime('2026-08-19T07:32:00.999Z')).toBe(want);
    expect(toZohoDateTime(Date.parse('2026-08-19T07:32:00Z'))).toBe(want);
  });

  it('returns null for anything it cannot parse', () => {
    for (const bad of ['not a date', '', null, undefined, {}, NaN]) {
      expect(toZohoDateTime(bad), String(bad)).toBeNull();
    }
  });

  it('omits the field entirely rather than sending a bad timestamp', () => {
    // A single unparseable value must not take the password write down with it.
    const payload = leadPasswordPayload({ Email: 'a@b.com' }, 'secret', { updatedAt: 'rubbish' });
    expect(payload).not.toHaveProperty('LMS_Password_Updated_At');
    expect(payload.LMS_Password).toBe('secret');
  });

  it('formats the timestamp it puts on a password payload', () => {
    const payload = leadPasswordPayload({}, 'secret', {
      updatedAt: new Date('2026-08-19T07:32:00.500Z'),
    });
    expect(payload.LMS_Password_Updated_At).toBe('2026-08-19T07:32:00+00:00');
  });
});

/**
 * Readable course names.
 *
 * The first successful sync put "YLwsh7uCJJQy4yiBAQ2i, MycpoZ5DpvOxjqnDc3G6"
 * into Enrolled_Courses — accurate, and no use at all to whoever opens the lead
 * in Zoho.
 */
describe('outbound lead payload · course names', () => {
  const TITLES = { abc123: '100BM Q1', def456: 'MBW Pre-Preparation' };
  const enrolled = { ...PROFILE, enrolledCourses: ['abc123', 'def456'] };

  it('writes titles when it has them', () => {
    const payload = profileToLeadFields('uid-1', enrolled, TITLES);
    expect(payload.Enrolled_Courses).toBe('100BM Q1, MBW Pre-Preparation');
  });

  it('falls back to the id for a course it cannot name', () => {
    // A course added since the cache was filled must still appear, not vanish.
    const payload = profileToLeadFields('uid-1', enrolled, { abc123: '100BM Q1' });
    expect(payload.Enrolled_Courses).toBe('100BM Q1, def456');
  });

  it('still works with no lookup at all', () => {
    // The lookup is allowed to fail; the sync is not.
    expect(profileToLeadFields('uid-1', enrolled).Enrolled_Courses).toBe('abc123, def456');
    expect(profileToLeadFields('uid-1', enrolled, null).Enrolled_Courses).toBe('abc123, def456');
  });

  it('handles a profile enrolled in nothing', () => {
    const payload = profileToLeadFields('uid-1', { ...PROFILE, enrolledCourses: undefined }, TITLES);
    expect(payload.Enrolled_Courses).toBe('');
  });
});
