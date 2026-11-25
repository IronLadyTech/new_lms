import { describe, it, expect } from 'vitest';
import { compareRoster, coqlForDay1 } from './zohoBatchCheck.js';

/** CEM press "Check against Zoho": counts and names must agree, and every difference says why. */
const lead = (id, name, email, extra = {}) => ({ id, Full_Name: name, Email: email, Lead_Status: 'LEP Enrolled', ...extra });
const learner = (uid, name, email, extra = {}) => ({ uid, data: { displayName: name, email, ...extra } });

describe('check a batch against Zoho', () => {
  it('reads Zoho by Day 1 in both batch styles and by LEP Start Date', () => {
    const q = coqlForDay1('2026-11-14');
    expect(q).toContain("LEP_Reg_Date = '2026-11-14'");
    expect(q).toContain("LEP_Batch like '14/11/2026%'");
    expect(q).toContain("LEP_Batch like '14 Nov 2026%'");
  });
  it('all match: same counts, no names to fix', () => {
    const r = compareRoster(
      [lead('1', 'Asha', 'a@x.com'), lead('2', 'Bina', 'b@x.com')],
      [learner('u1', 'Asha', 'A@x.com'), learner('u2', 'Bina', 'other@x.com', { zohoLeadId: '2' })],
      { day1: '2026-11-14' }
    );
    expect(r).toMatchObject({ zohoCount: 2, appCount: 2, matched: 2, onlyZoho: [], onlyApp: [] });
  });
  it('matched by mobile when the emails differ', () => {
    const r = compareRoster([lead('1', 'Asha', 'a@x.com', { Mobile: '80502 77067' })], [learner('u1', 'Asha', 'z@y.com', { phoneNumber: '+918050277067' })], { day1: 'x' });
    expect(r.matched).toBe(1);
  });
  it('each difference says why and what to do', () => {
    const r = compareRoster(
      [lead('1', 'Asha', 'a@x.com'), lead('2', 'Bina', 'b@x.com'), lead('3', 'Chitra', 'c@x.com')],
      [learner('u9', 'Divya', 'd@x.com', { programAccess: { lep: { zohoRawBatch: '21/11/2026 - 21/12/2026' } } })],
      { day1: '2026-11-14', elsewhere: { 'a@x.com': null, 'b@x.com': '2026-11-21', 'c@x.com': '2026-11-14' } }
    );
    expect(r.onlyZoho.map((x) => [x.name, x.why.split('.')[0]])).toEqual([
      ['Asha', 'Has not signed in to the app yet'],
      ['Bina', 'The app has her in the 2026-11-21 batch'],
      ['Chitra', 'Has an app account but is not in this batch yet'],
    ]);
    expect(r.onlyApp[0].name).toBe('Divya');
    expect(r.onlyApp[0].why).toContain('21/11/2026');
  });
  it('dropped or refunded Zoho leads are not counted', () => {
    const r = compareRoster([lead('1', 'Asha', 'a@x.com', { Lead_Status: 'Dropped' })], [], { day1: 'x' });
    expect(r.zohoCount).toBe(0);
  });
});
