import { describe, it, expect } from 'vitest';
import { applyLepFeeToUpdates } from './zohoProvisioning.js';

const run = (record) => {
  const u = {};
  applyLepFeeToUpdates(u, record);
  return u;
};

describe('LEP fee from the Lead', () => {
  it('registered only: balance is pitched minus 2999', () => {
    const u = run({ LEP_Payment_Amount: '2999', LEP_Full_Amount: null, LEP_Pitched_Amount: 20999 });
    expect(u['programAccess.lep.programBalance']).toBe(18000);
    expect(u['programAccess.lep.feePaid']).toBe(2999);
    expect(u['programAccess.lep.courseFee']).toBe(20999);
    expect(u['programAccess.lep.registrationFee']).toBe(2999);
  });
  it('part paid by bank transfer', () => {
    const u = run({ LEP_Payment_Amount: '2999', LEP_Full_Amount: '₹ 10,000', LEP_Pitched_Amount: '20999' });
    expect(u['programAccess.lep.programBalance']).toBe(8000);
  });
  it('paid in full, or a pitched typo below paid: 0, never negative', () => {
    expect(run({ LEP_Payment_Amount: 2999, LEP_Full_Amount: 20500, LEP_Pitched_Amount: 23499 })['programAccess.lep.programBalance']).toBe(0);
    expect(run({ LEP_Payment_Amount: 2999, LEP_Full_Amount: 20500, LEP_Pitched_Amount: 2000 })['programAccess.lep.programBalance']).toBe(0);
  });
  it('pitched empty: no balance on record', () => {
    const u = run({ LEP_Payment_Amount: '2999', LEP_Pitched_Amount: null });
    expect(u['programAccess.lep.programBalance']).toBeNull();
    expect(u['programAccess.lep.courseFee']).toBeNull();
  });
  it('a record without the field (IL_Users) changes nothing', () => {
    expect(run({ LEP_Payment_Amount: '2999' })).toEqual({});
  });
});
