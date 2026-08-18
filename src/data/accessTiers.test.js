import { describe, it, expect } from 'vitest';
import {
  normalizePaymentStatus,
  hasFullProgramAccess,
  PAYMENT_STATUS,
} from './accessTiers';

/*
 * These are the payment statuses actually present on live learner profiles,
 * counted from the admin Zoho table on 17 Aug 2026:
 *
 *   paid 267 · completed 157 · register 60 · unpaid 14 · failed 2
 *
 * "completed" and "failed" were in none of the recognised lists. Both fell
 * through normalizePaymentStatus to `return v`, then through
 * hasFullProgramAccess to `if (!tier) return true` — so 159 of 500 learners,
 * including every failed payment, were handed the full programme. The gate
 * itself was never broken; it was simply never asked about them.
 */
describe('normalizePaymentStatus — the words Zoho actually sends', () => {
  it('treats a completed registration transaction as the registration tier', () => {
    /*
     * "Completed" is the registration payment finishing, not the programme fee.
     * The enrolment Deluge deliberately omits paymentstatus for exactly this
     * reason, and paymentStatusFromRegistrationPayload maps it the same way.
     */
    expect(normalizePaymentStatus('completed')).toBe(PAYMENT_STATUS.REGISTER);
    expect(normalizePaymentStatus('Completed')).toBe(PAYMENT_STATUS.REGISTER);
    // 'complete' remains a full payment; only the past-tense form is the
    // registration transaction.
    expect(normalizePaymentStatus('complete')).toBe(PAYMENT_STATUS.PAID);
  });

  it('treats a payment that did not succeed as unpaid', () => {
    for (const v of ['failed', 'declined', 'cancelled', 'canceled', 'refunded', 'expired']) {
      expect(normalizePaymentStatus(v), v).toBe(PAYMENT_STATUS.UNPAID);
    }
  });

  it('keeps the statuses that already worked', () => {
    expect(normalizePaymentStatus('paid')).toBe(PAYMENT_STATUS.PAID);
    expect(normalizePaymentStatus('register')).toBe(PAYMENT_STATUS.REGISTER);
    expect(normalizePaymentStatus('unpaid')).toBe(PAYMENT_STATUS.UNPAID);
    expect(normalizePaymentStatus(undefined)).toBe(PAYMENT_STATUS.UNPAID);
  });
});

describe('hasFullProgramAccess — who reaches paid content', () => {
  it('opens paid content only for a full programme payment', () => {
    expect(hasFullProgramAccess({ paymentStatus: 'paid' })).toBe(true);
  });

  it('withholds paid content from registration-only and unpaid learners', () => {
    expect(hasFullProgramAccess({ paymentStatus: 'register' })).toBe(false);
    expect(hasFullProgramAccess({ paymentStatus: 'completed' })).toBe(false);
    expect(hasFullProgramAccess({ paymentStatus: 'unpaid' })).toBe(false);
  });

  it('withholds paid content when the payment failed', () => {
    // Previously true: a failed payment bought the whole programme.
    expect(hasFullProgramAccess({ paymentStatus: 'failed' })).toBe(false);
    expect(hasFullProgramAccess({ paymentStatus: 'refunded' })).toBe(false);
  });

  it('withholds paid content for a status nobody has taught it', () => {
    // The important one. A word Zoho invents tomorrow must not grant access
    // merely because this file has not heard of it yet.
    expect(hasFullProgramAccess({ paymentStatus: 'awaiting_settlement' })).toBe(false);
    expect(hasFullProgramAccess({ paymentStatus: 'chargeback' })).toBe(false);
  });

  it('withholds paid content from a brand-new profile carrying no status', () => {
    expect(hasFullProgramAccess({ email: 'demo@example.com', enrolledCourses: [] })).toBe(false);
    expect(hasFullProgramAccess({})).toBe(false);
    expect(hasFullProgramAccess(null)).toBe(false);
  });

  it('still honours an explicit full access tier', () => {
    expect(hasFullProgramAccess({ paymentStatus: 'paid', accessTier: 'full' })).toBe(true);
  });
});
