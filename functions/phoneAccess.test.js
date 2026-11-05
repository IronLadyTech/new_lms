import { describe, it, expect } from 'vitest';
import phoneAccess from './phoneAccess.js';

const { hasProgrammeSeat } = phoneAccess;

/**
 * Zoho creates an IL_Users row for every new Lead. A "Follow Up" lead who signed
 * in on the app was handed a 100BM account at 'register' because the row alone
 * was read as a seat. These are the cases that decide guest or learner.
 */

const emptyIlUser = { Email: 'demo@123gmail.com', Name: 'App_User_4', Program_Registration_Details: null };
const db = (profile) => ({
  collection: () => ({ doc: () => ({ get: async () => ({ data: () => profile }) }) }),
});
const leads = (...statuses) => ({
  searchLeadsByPhone: async () => statuses.map((status) => ({ status })),
  getAuthUserByEmail: async () => null,
});
const withAccount = (deps) => ({ ...deps, getAuthUserByEmail: async () => ({ uid: 'u1' }) });

describe('hasProgrammeSeat', () => {
  it('a Follow Up lead with an empty IL_Users row and no account is a guest', async () => {
    expect(await hasProgrammeSeat(db(null), '+911234567123', emptyIlUser, leads('Follow Up'))).toBe(false);
  });

  it('an account left at register only at the top level is still a guest', async () => {
    const profile = { role: 'student', paymentStatus: 'register', programAccess: { '100bm': { paymentStatus: 'unpaid' } } };
    expect(await hasProgrammeSeat(db(profile), '+911234567123', emptyIlUser, withAccount(leads('Follow Up')))).toBe(false);
  });

  it('a programme on the IL_Users lists is a seat', async () => {
    const ilUser = { ...emptyIlUser, Program_Registration_Details: 'Leadership Essentials Program' };
    expect(await hasProgrammeSeat(db(null), '+91', ilUser, leads())).toBe(true);
  });

  it('a Lead status of enrolled or started is a seat while the lists catch up', async () => {
    expect(await hasProgrammeSeat(db(null), '+91', emptyIlUser, leads('Follow Up', 'LEP Enrolled'))).toBe(true);
    expect(await hasProgrammeSeat(db(null), '+91', emptyIlUser, leads('100 BM started'))).toBe(true);
  });

  it('a programme already held in the app is a seat', async () => {
    const profile = { role: 'student', programAccess: { lep: { paymentStatus: 'paid' } } };
    expect(await hasProgrammeSeat(db(profile), '+91', emptyIlUser, withAccount(leads('Follow Up')))).toBe(true);
  });

  it('staff are never sent to the guest flow', async () => {
    expect(await hasProgrammeSeat(db({ role: 'moderator' }), '+91', emptyIlUser, withAccount(leads()))).toBe(true);
  });

  it('when Zoho cannot be reached it lets her in, as before', async () => {
    const failing = { searchLeadsByPhone: async () => { throw new Error('Zoho down'); } };
    expect(await hasProgrammeSeat(db(null), '+91', emptyIlUser, failing)).toBe(true);
  });
});

describe('claimPhoneAccess', () => {
  const verified = (decoded) => ({
    verifyIdToken: async () => {
      if (decoded instanceof Error) throw decoded;
      return decoded;
    },
  });

  it('refuses without the verified SMS token', async () => {
    const out = await phoneAccess.claimPhoneAccess(db(null), undefined, {});
    expect(out.ok).toBe(false);
    expect(out.token).toBeUndefined();
  });

  it('refuses an invalid or expired token', async () => {
    const out = await phoneAccess.claimPhoneAccess(db(null), 'bad', verified(new Error('expired')));
    expect(out.ok).toBe(false);
    expect(out.token).toBeUndefined();
  });

  it('refuses a token that did not come from a phone sign-in', async () => {
    const out = await phoneAccess.claimPhoneAccess(
      db(null),
      'tok',
      verified({ uid: 'x', phone_number: '+918050277067', firebase: { sign_in_provider: 'password' } })
    );
    expect(out.ok).toBe(false);
  });

  it('looks up the number inside the verified token, not one from the request', async () => {
    let asked = null;
    const lookupDb = {
      collection: () => ({ doc: (id) => ({ get: async () => { asked = id; return { exists: false, data: () => null }; } }) }),
    };
    const out = await phoneAccess.claimPhoneAccess(lookupDb, 'tok', {
      ...verified({ uid: 'p1', phone_number: '+918050277067', firebase: { sign_in_provider: 'phone' } }),
      isConfigured: () => false,
    });
    expect(asked).toBe('8050277067');
    expect(out.token).toBeUndefined();
  });
});
