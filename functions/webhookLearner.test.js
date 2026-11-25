import { describe, it, expect } from 'vitest';
import { resolveWebhookEmail } from './webhookLearner.js';

/** Zoho calls the batch webhook with the Lead's email, its mobile, or both. */
function fakeDb(users = []) {
  return {
    collection: () => ({
      where: (field, _op, value) => ({
        limit: () => ({
          get: async () => ({ docs: users.filter((u) => u[field] === value).map((u) => ({ data: () => u })) }),
        }),
      }),
    }),
  };
}

describe('which learner a webhook call is about', () => {
  it('email wins when Zoho sends it', async () => {
    expect(await resolveWebhookEmail(fakeDb(), { email: ' Asha@X.com ', phone: '9876543210' })).toEqual({
      email: 'asha@x.com',
      via: 'email',
    });
  });
  it('phone only: the email on her Zoho Lead', async () => {
    const searchLeadsByPhone = async () => [{ email: '' }, { email: 'asha@x.com' }];
    const r = await resolveWebhookEmail(fakeDb(), { phone: '+91 98765 43210' }, { searchLeadsByPhone });
    expect(r).toEqual({ email: 'asha@x.com', via: 'zoho-phone' });
  });
  it('phone only, Lead has no email: her app profile', async () => {
    const db = fakeDb([{ phoneNumber: '+919876543210', email: 'asha@x.com' }]);
    const r = await resolveWebhookEmail(db, { Mobile: '09876543210' }, { searchLeadsByPhone: async () => [] });
    expect(r).toEqual({ email: 'asha@x.com', via: 'lms-phone' });
  });
  it('nothing usable: a clear reason, no phone number in it', async () => {
    const r = await resolveWebhookEmail(fakeDb(), { phone: '9876543210' }, { searchLeadsByPhone: async () => [] });
    expect(r.email).toBeNull();
    expect(r.reason).not.toContain('9876543210');
    expect((await resolveWebhookEmail(fakeDb(), {})).reason).toBe('email or phone is required');
  });
});
