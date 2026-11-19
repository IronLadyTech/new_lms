import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import { isTestAccount, resolveBalancePaise, testKeys, verifyPayment } from './razorpayPayments.js';

/** Test payments for chosen accounts only; every other learner keeps the live keys. */
const env = { RAZORPAY_TEST_KEY_ID: 'rzp_test_abc', RAZORPAY_TEST_KEY_SECRET: 'tsecret', RAZORPAY_TEST_USERS: 'demo@123gmail.com, 98765 43210' };

describe('which accounts pay in test mode', () => {
  it('listed email or mobile: test mode', () => {
    expect(isTestAccount({ email: 'Demo@123gmail.com' }, env)).toBe(true);
    expect(isTestAccount({ phoneNumber: '+919876543210' }, env)).toBe(true);
  });
  it('anyone else: live', () => {
    expect(isTestAccount({ email: 'learner@x.com', phoneNumber: '+919000000000' }, env)).toBe(false);
  });
  it('a live key put in the test slot is never used as test', () => {
    expect(testKeys({ ...env, RAZORPAY_TEST_KEY_ID: 'rzp_live_x' })).toBe(null);
    expect(isTestAccount({ email: 'demo@123gmail.com' }, { ...env, RAZORPAY_TEST_KEY_ID: 'rzp_live_x' })).toBe(false);
  });
});

describe('a test order is checked with the test secret', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const sign = (secret) => crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
  const db = (order) => {
    const docs = {};
    return {
      docs,
      collection: (c) => ({
        doc: (id) => ({
          get: async () =>
            c === 'razorpay_orders'
              ? { exists: true, data: () => order }
              : c === 'users'
                ? { exists: true, data: () => ({ email: 'demo@123gmail.com' }) }
                : { exists: !!docs[`${c}/${id}`], data: () => docs[`${c}/${id}`] },
          set: async (p) => (docs[`${c}/${id}`] = { ...(docs[`${c}/${id}`] || {}), ...p }),
          update: async (p) => (docs[`${c}/${id}`] = { ...(docs[`${c}/${id}`] || {}), ...p }),
        }),
      }),
    };
  };
  const req = (signature) => ({ auth: { uid: 'u1' }, data: { orderId: 'order_1', paymentId: 'pay_1', signature } });

  it('test order + test signature: accepted and marked as a test payment', async () => {
    Object.assign(process.env, env);
    const d = db({ uid: 'u1', programId: 'lep', amountPaise: 100, testMode: true });
    const res = await verifyPayment(req(sign('tsecret')), d, 'rzp_live_x', 'lsecret');
    expect(res.ok).toBe(true);
    expect(d.docs['razorpay_payments/pay_1'].testMode).toBe(true);
  });
  it('a live order cannot be passed with a test signature', async () => {
    Object.assign(process.env, env);
    const d = db({ uid: 'u1', programId: 'lep', amountPaise: 100 });
    await expect(verifyPayment(req(sign('tsecret')), d, 'rzp_live_x', 'lsecret')).rejects.toThrow(/verification failed/);
  });
});

/** Money: no stand-in amount for real learners (it charged live ₹1 and enrolled them). */
describe('balance to charge', () => {
  const saved = process.env.RAZORPAY_DEFAULT_BALANCE_PAISE;
  afterEach(() => {
    if (saved === undefined) delete process.env.RAZORPAY_DEFAULT_BALANCE_PAISE;
    else process.env.RAZORPAY_DEFAULT_BALANCE_PAISE = saved;
  });
  it('charges the balance on record', () => {
    process.env.RAZORPAY_DEFAULT_BALANCE_PAISE = '100';
    expect(resolveBalancePaise({ programAccess: { lep: { programBalance: 47001 } } }, 'lep')).toBe(4700100);
  });
  it('a real learner with no balance on record is refused, never charged ₹1', () => {
    process.env.RAZORPAY_DEFAULT_BALANCE_PAISE = '100';
    expect(() => resolveBalancePaise({ programAccess: { lep: {} } }, 'lep')).toThrow(/balance amount is not set/);
  });
  it('a test account with no balance may use the test fallback', () => {
    process.env.RAZORPAY_DEFAULT_BALANCE_PAISE = '100';
    expect(resolveBalancePaise({ programAccess: { lep: {} } }, 'lep', { testAccount: true })).toBe(100);
  });
});
