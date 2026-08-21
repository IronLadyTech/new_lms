import { describe, it, expect } from 'vitest';
import provisioning from './zohoProvisioning.js';

const { syncEntitlementsFromZoho } = provisioning;

/**
 * Lead Status changes for people who are not learners.
 *
 * Zoho posts to the LMS on every Lead Status change and mails CX when the LMS
 * replies not-ok. The MC stages are the masterclass funnel — they name no
 * programme and grant no access — so a lead moving through them has nothing for
 * the LMS to apply and no reason to hold an LMS account. Reporting that as a
 * failure produced an alert mail per masterclass lead, which buries the
 * failures that matter.
 *
 * The distinction being held here is "nothing to do" versus "something is
 * wrong". Getting it backwards either floods the inbox or hides a learner who
 * enrolled and never got an account.
 */

const noAccount = { getAuthUserByEmail: async () => null };
const hasAccount = { getAuthUserByEmail: async () => ({ uid: 'uid-1' }) };

/*
 * Only reached when an account exists — the no-account paths return before
 * touching Firestore, which is the point of most of these tests.
 */
const emptyQuery = { empty: true, docs: [] };
const fakeDb = {
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ email: 'learner@example.com' }) }),
      update: async () => {},
      set: async () => {},
    }),
    where: () => ({ limit: () => ({ get: async () => emptyQuery }) }),
  }),
};

const post = (body, deps = noAccount) =>
  syncEntitlementsFromZoho(fakeDb, async () => null, async () => null, body.email, body, deps);

describe('lead status change · nothing to do', () => {
  it.each(['MC Enrolled', 'MC Completed'])('accepts %s for a lead with no account', async (status) => {
    // The exact case that was mailing CX: masterclass stages grant nothing.
    const r = await post({ email: 'lead@example.com', Lead_Status: status });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe('no-account-and-none-expected');
  });

  it('explains itself rather than just going quiet', async () => {
    const r = await post({ email: 'lead@example.com', Lead_Status: 'MC Enrolled' });
    expect(r.reason).toContain('MC Enrolled');
    expect(r.reason).toMatch(/nothing to apply/i);
  });
});

describe('lead status change · genuinely wrong', () => {
  it.each([
    '100 BM Enrolled',
    '100 BM started',
    'MBW Enrolled',
    'LEP Enrolled',
  ])('still reports %s with no LMS account', async (status) => {
    /*
     * Somebody who enrolled in a programme and has no account is a real gap —
     * they paid and cannot log in. This must keep reaching CX.
     */
    const r = await post({ email: 'learner@example.com', Lead_Status: status });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no lms account/i);
  });

  it('reports when the status is missing entirely', async () => {
    // Unknown is not the same as harmless.
    const r = await post({ email: 'learner@example.com' });
    expect(r.ok).toBe(false);
  });

  it('still requires an email', async () => {
    const r = await post({ email: '  ' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/email/i);
  });
});

describe('lead status change · the quiet path is narrow', () => {
  it('does not fire when the learner does have an account', async () => {
    // With an account present the function must go on and apply entitlements,
    // never return the skip.
    const r = await post({ email: 'learner@example.com', Lead_Status: 'MC Enrolled' }, hasAccount);
    expect(r.skipped).not.toBe('no-account-and-none-expected');
  });
});

/**
 * Healing a missing account.
 *
 * A status naming a programme says this person registered, so an account should
 * exist. Refusing made that permanent — the registration webhook is the only
 * thing that creates one, and nothing retried when it missed. Provisioning
 * reads IL_Registration, where the credentials actually are, so the status
 * change can now close the gap rather than only reporting it.
 */
describe('lead status change · healing a missing account', () => {
  const healing = (provisionResult, calls) => ({
    getAuthUserByEmail: async () => (calls.provisioned ? { uid: 'uid-new' } : null),
    provisionMissing: async (email) => {
      calls.provisioned = true;
      calls.email = email;
      return provisionResult;
    },
  });

  it('provisions the account and then applies the entitlements', async () => {
    const calls = {};
    const r = await post(
      { email: 'learner@example.com', Lead_Status: 'LEP Enrolled' },
      healing({ ok: true }, calls)
    );
    expect(calls.provisioned).toBe(true);
    expect(calls.email).toBe('learner@example.com');
    expect(r.ok).toBe(true);
    expect(r.uid).toBe('uid-new');
  });

  it('does not try to provision a masterclass lead', async () => {
    // MC grants nothing; creating an account for it would be wrong.
    const calls = {};
    const r = await post(
      { email: 'lead@example.com', Lead_Status: 'MC Enrolled' },
      healing({ ok: true }, calls)
    );
    expect(calls.provisioned).toBeUndefined();
    expect(r.skipped).toBe('no-account-and-none-expected');
  });

  it('reports why provisioning failed rather than a bare no-account', async () => {
    /*
     * The reason is the actionable part — "no password on IL_Registration" is
     * something CX can fix; "no LMS account" is not.
     */
    const calls = {};
    const r = await post(
      { email: 'learner@example.com', Lead_Status: '100 BM Enrolled' },
      healing({ ok: false, reason: 'Password not found for batch provisioning' }, calls)
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Password not found');
  });

  it('survives provisioning throwing', async () => {
    const r = await post(
      { email: 'learner@example.com', Lead_Status: 'MBW Enrolled' },
      {
        getAuthUserByEmail: async () => null,
        provisionMissing: async () => {
          throw new Error('Zoho timeout');
        },
      }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Zoho timeout');
  });

  it('tries exactly once, even if the account is still missing after', async () => {
    // Without the guard this recurses until the stack gives out.
    let count = 0;
    const r = await post(
      { email: 'learner@example.com', Lead_Status: 'LEP Enrolled' },
      {
        getAuthUserByEmail: async () => null,
        provisionMissing: async () => {
          count += 1;
          return { ok: true };
        },
      }
    );
    expect(count).toBe(1);
    expect(r.ok).toBe(false);
  });

  it('still refuses when no provisioner is wired in', async () => {
    const r = await post({ email: 'learner@example.com', Lead_Status: 'LEP Enrolled' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no lms account/i);
  });
});
