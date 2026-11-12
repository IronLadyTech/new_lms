import { describe, it, expect, afterEach } from 'vitest';
import { reconcileRazorpayPayments } from './razorpayPayments.js';
import { zohoState, runCmsListAppPayments } from './appPaymentsAdmin.js';

/** Nothing paid in the app can go missing: Razorpay is checked every night. */
function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const doc = (c, id) => ({
    id,
    get: async () => ({ id, exists: !!data[c]?.[id], data: () => data[c]?.[id], ref: doc(c, id) }),
    set: async (p) => ((data[c] = data[c] || {}), (data[c][id] = { ...(data[c][id] || {}), ...p })),
    update: async (p) => {
      const cur = { ...(data[c][id] || {}) };
      for (const [k, v] of Object.entries(p)) {
        const parts = k.split('.');
        let o = cur;
        while (parts.length > 1) { const x = parts.shift(); o[x] = { ...(o[x] || {}) }; o = o[x]; }
        o[parts[0]] = v;
      }
      data[c][id] = cur;
    },
  });
  return {
    data,
    collection: (c) => ({
      doc: (id) => doc(c, id),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: Object.entries(data[c] || {}).map(([id, d]) => ({ id, data: () => d })) }) }) }),
    }),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
  };
}

describe('nightly check against Razorpay', () => {
  const saved = { ...process.env };
  afterEach(() => (process.env = { ...saved }));
  const seed = () => ({
    users: { u1: { email: 'a@x.com', programAccess: { lep: { paymentStatus: 'register' } } } },
    razorpay_orders: { order_lost: { uid: 'u1', programId: 'lep', amountPaise: 100, status: 'created' }, order_ok: { uid: 'u1', programId: 'lep', status: 'paid' } },
    razorpay_payments: { pay_ok: { uid: 'u1', orderId: 'order_ok' } },
  });
  const razorpay = [
    { id: 'pay_lost', order_id: 'order_lost', status: 'captured', amount: 100 }, // app closed before it confirmed
    { id: 'pay_ok', order_id: 'order_ok', status: 'captured', amount: 100 }, // already recorded
    { id: 'pay_web', order_id: 'order_website', status: 'captured', amount: 500000 }, // not an app order
    { id: 'pay_fail', order_id: 'order_lost', status: 'failed', amount: 100 },
  ];
  it('records the payment the app missed, unlocks her, leaves everything else alone', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_x';
    process.env.RAZORPAY_KEY_SECRET = 's';
    const db = fakeDb(seed());
    const res = await reconcileRazorpayPayments(db, { days: 2 }, { modes: ['live'], listPayments: async () => razorpay });
    expect(res.recovered.map((r) => r.paymentId)).toEqual(['pay_lost']);
    expect(db.data.razorpay_payments.pay_lost).toMatchObject({ uid: 'u1', source: 'razorpay-check' });
    expect(db.data.razorpay_orders.order_lost.status).toBe('paid');
    expect(db.data.users.u1.programAccess.lep.paymentStatus).toBe('paid');
    expect(db.data.razorpay_payments.pay_web).toBeUndefined();
    expect(db.data.app_stats.razorpayCheck.recovered).toHaveLength(1);
  });
  it('Razorpay unreachable: reported, nothing changed', async () => {
    const db = fakeDb(seed());
    const res = await reconcileRazorpayPayments(db, {}, { modes: ['live'], listPayments: async () => { throw new Error('timeout'); } });
    expect(res.errors[0]).toMatch(/timeout/);
    expect(db.data.razorpay_payments.pay_lost).toBeUndefined();
  });
});

describe('CMS: App payments', () => {
  it('the Zoho column CX see', () => {
    expect(zohoState({ zohoSyncedAt: new Date() })).toBe('done');
    expect(zohoState({ zohoError: 'x', zohoTries: 2 })).toBe('retrying');
    expect(zohoState({ zohoError: 'x', zohoTries: 10 })).toBe('attention');
    expect(zohoState({})).toBe('waiting');
  });
  it('staff see each payment with the learner’s name and last 4 digits only', async () => {
    const db = fakeDb({
      users: { staff: { role: 'cem' }, u1: { displayName: 'Sharvanth', phoneNumber: '+919440025911', email: 'x@y.com' } },
      razorpay_payments: { pay_1: { uid: 'u1', programId: 'lep', amountPaise: 100, testMode: true, zohoError: 'boom', zohoTries: 1 } },
    });
    const res = await runCmsListAppPayments(db, { auth: { uid: 'staff' } });
    expect(res.payments[0]).toMatchObject({ name: 'Sharvanth', phone: '5911', amount: 1, test: true, zoho: 'retrying' });
    await expect(runCmsListAppPayments(db, { auth: { uid: 'u1' } })).rejects.toThrow();
  });
});
