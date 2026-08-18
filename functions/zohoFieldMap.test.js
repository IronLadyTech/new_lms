import { describe, it, expect } from 'vitest';
import zohoFieldMap from './zohoFieldMap.js';

const { parseLeadEntitlements } = zohoFieldMap;

/*
 * Lead Status is the journey pointer, and these are the literal strings Zoho
 * holds — taken from a live 72-learner cohort, where 46% read "... started".
 *
 * The rule, confirmed with the team: "enrolled" is the registration amount
 * paid (partial unlock) and "started" is the full course amount paid (full
 * unlock). The test that matters is "started", because /\bstart\b/ matched only
 * the bare word, so nearly half the learners who had paid in full were graded
 * unpaid and locked out of the content they bought.
 */
const entitlement = (status) => parseLeadEntitlements({ Lead_Status: status });

describe('parseLeadEntitlements — the statuses Zoho actually holds', () => {
  it('reads a started programme as paid in full', () => {
    for (const status of ['100 BM started', 'MBW started', 'LEP started', '100 BM Started']) {
      expect(entitlement(status).paymentStatus, status).toBe('paid');
    }
  });

  it('reads an enrolled programme as the registration tier', () => {
    expect(entitlement('100 BM Enrolled').paymentStatus).toBe('register');
    expect(entitlement('MBW Enrolled').paymentStatus).toBe('register');
  });

  it('names the programme from the status', () => {
    expect(entitlement('100 BM started').program).toBe('100bm');
    expect(entitlement('MBW Enrolled').program).toBe('mbw');
    expect(entitlement('LEP Completed').program).toBe('lep');
  });

  it('gives a follow-up lead no programme and no payment', () => {
    const ent = entitlement('Follow up');
    expect(ent.program).toBeNull();
    expect(ent.paymentStatus).toBe('unpaid');
  });

  it('does not mistake a status with no programme for an entitlement', () => {
    expect(entitlement('').program).toBeNull();
    expect(entitlement('Junk Value').program).toBeNull();
  });
});
