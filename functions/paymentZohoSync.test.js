import { describe, it, expect } from 'vitest';
import { syncPaymentToZoho, paidLeadStatus, paymentNote } from './paymentZohoSync.js';

/** She pays her balance in the app: Zoho shows it at once, without CX doing anything. */
describe('Lead Status after a payment in the app', () => {
  it('Enrolled moves to Started, per programme, with Zoho’s exact spelling', () => {
    expect(paidLeadStatus('lep', 'LEP Enrolled')).toBe('LEP Started');
    expect(paidLeadStatus('100bm', '100 BM Enrolled')).toBe('100 BM started');
    expect(paidLeadStatus('mbw', 'MBW Enrolled')).toBe('MBW started');
  });
  it('never moves backwards or over a refund', () => {
    expect(paidLeadStatus('lep', 'LEP Started')).toBe(null);
    expect(paidLeadStatus('lep', 'LEP Completed')).toBe(null);
    expect(paidLeadStatus('lep', 'LEP Refund Initiated')).toBe(null);
  });
  it('another programme’s status does not block it', () => {
    expect(paidLeadStatus('lep', 'MC Completed')).toBe('LEP Started');
  });
  it('the Note says what was paid, the Razorpay ids and the status change', () => {
    const n = paymentNote({ programId: 'lep', amountPaise: 2500000, paymentId: 'pay_1', orderId: 'order_1', from: 'LEP Enrolled', to: 'LEP Started', at: new Date('2026-11-11T06:30:00Z') });
    expect(n.title).toBe('Paid in the app: LEP ₹25,000');
    expect(n.content).toContain('2026-11-11 12:00 IST');
    expect(n.content).toContain('pay_1');
    expect(n.content).toContain('from "LEP Enrolled" to "LEP Started"');
  });
});

function fakeDb(users) {
  const docs = {};
  return {
    docs,
    collection: (c) => ({
      doc: (id) => ({
        get: async () => (c === 'users' ? { exists: !!users[id], data: () => users[id] } : { exists: !!docs[id], data: () => docs[id] }),
        set: async (p) => (docs[id] = { ...(docs[id] || {}), ...p }),
      }),
    }),
  };
}
const fakeZoho = (status) => {
  const calls = { updates: [], notes: [] };
  return {
    calls,
    findLeadId: async (p) => (p.email === 'a@x.com' && p.uid === 'u1' ? 'L1' : null),
    getLeadById: async () => ({ id: 'L1', Lead_Status: status }),
    updateLead: async (id, f) => calls.updates.push([id, f]),
    addNote: async (id, t) => calls.notes.push([id, t]),
  };
};
const pay = { uid: 'u1', programId: 'lep', paymentId: 'pay_1', orderId: 'order_1', amountPaise: 2500000 };

describe('payment → Zoho', () => {
  it('updates her Lead and records it once, however often the payment is reported', async () => {
    const db = fakeDb({ u1: { email: 'a@x.com' } });
    const z = fakeZoho('LEP Enrolled');
    expect(await syncPaymentToZoho(db, pay, z)).toMatchObject({ ok: true, from: 'LEP Enrolled', to: 'LEP Started' });
    await syncPaymentToZoho(db, pay, z); // Razorpay webhook after the app
    expect(z.calls.updates).toEqual([['L1', { Lead_Status: 'LEP Started' }]]);
    expect(z.calls.notes).toHaveLength(1);
    expect(db.docs.pay_1.zohoStatusTo).toBe('LEP Started');
  });
  it('already Started: status untouched, Note still added', async () => {
    const db = fakeDb({ u1: { email: 'a@x.com' } });
    const z = fakeZoho('LEP Started');
    await syncPaymentToZoho(db, pay, z);
    expect(z.calls.updates).toEqual([]);
    expect(z.calls.notes).toHaveLength(1);
  });
  it('no Lead found: the payment still stands, the reason is saved for a retry', async () => {
    const db = fakeDb({ u1: { email: 'other@x.com' } });
    const res = await syncPaymentToZoho(db, pay, fakeZoho('LEP Enrolled'));
    expect(res.ok).toBe(false);
    expect(db.docs.pay_1.zohoError).toMatch(/No Zoho Lead/);
    expect(db.docs.pay_1.zohoSyncedAt).toBeUndefined();
  });
});

describe('a failed Zoho update is tried again', () => {
  it('retries until it reaches Zoho, then stops', async () => {
    const { retryFailedPaymentSyncs } = await import('./paymentZohoSync.js');
    const docs = { pay_1: { uid: 'u1', programId: 'lep', orderId: 'order_1', amountPaise: 100, testMode: true, zohoError: 'Unexpected end of JSON input' } };
    const users = { u1: { email: 'a@x.com' } };
    const db = {
      collection: (c) => ({
        where: () => ({ limit: () => ({ get: async () => ({ docs: Object.entries(docs).filter(([, d]) => d.zohoError).map(([id, d]) => ({ id, data: () => d, ref: { set: async (p) => Object.assign(docs[id], p) } })) }) }) }),
        doc: (id) => ({
          get: async () => (c === 'users' ? { exists: true, data: () => users[id] } : { exists: !!docs[id], data: () => docs[id] }),
          set: async (p) => Object.assign((docs[id] = docs[id] || {}), p),
        }),
      }),
    };
    const z = fakeZoho('LEP Enrolled');
    expect(await retryFailedPaymentSyncs(db, z)).toEqual({ tried: 1, fixed: 1 });
    expect(docs.pay_1.zohoStatusTo).toBe('LEP Started');
    expect(z.calls.notes[0][1]).toMatch(/^TEST payment/);
    expect(await retryFailedPaymentSyncs(db, z)).toEqual({ tried: 0, fixed: 0 });
  });
});

describe('Zoho Blueprint step for a payment', () => {
  it('picks the step to the paid status', async () => {
    const { pickTransition } = await import('./paymentZohoSync.js');
    const steps = [{ id: '1', name: 'MC Completed', next_field_value: 'MC Completed' }, { id: '2', name: 'LEP Started', next_field_value: 'LEP Started' }];
    expect(pickTransition(steps, 'LEP Started').id).toBe('2');
    expect(pickTransition([{ id: '3', name: '100BM Started', next_field_value: '100 BM started' }], '100 BM started').id).toBe('3');
    expect(pickTransition(steps, 'MBW started')).toBe(null);
  });
  it('fills what the step asks: amount (keeps the fee CX entered), Razorpay id, Completed', async () => {
    const { transitionData } = await import('./paymentZohoSync.js');
    const fields = [{ api_name: 'LEP_Full_Amount' }, { data_type: 'message' }, { api_name: 'LEP_Enrollment_Transaction_Id' }, { api_name: 'LEP_Registration_Payment_Status' }];
    expect(transitionData(fields, {}, { amountPaise: 2500000, paymentId: 'pay_1' })).toEqual({
      LEP_Full_Amount: '25000',
      LEP_Enrollment_Transaction_Id: 'pay_1',
      LEP_Registration_Payment_Status: 'Completed',
    });
    expect(transitionData(fields, { LEP_Full_Amount: '45000' }, { amountPaise: 100, paymentId: 'pay_1' }).LEP_Full_Amount).toBe('45000');
  });
  it('the sync uses the Blueprint step when Zoho has one', async () => {
    const db = fakeDb({ u1: { email: 'a@x.com' } });
    const z = fakeZoho('LEP Enrolled');
    const moved = [];
    z.moveToStatus = async (id, lead, to) => moved.push([id, to]);
    await syncPaymentToZoho(db, pay, z);
    expect(moved).toEqual([['L1', 'LEP Started']]);
    expect(z.calls.updates).toEqual([]);
  });
});
