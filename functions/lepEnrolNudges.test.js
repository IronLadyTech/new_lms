import { describe, it, expect } from 'vitest';
import { enrolNudgeFires, wantsEnrolNudge, orientationDay, NUDGES } from './lepEnrolNudges.js';

/** Part-paid learners hear about enrolment before orientation: twice, at lunch, never after paying. */
const batch = {
  id: 'b14',
  sessions: [{ code: 'S0', date: '2026-11-12' }, { code: 'S1', date: '2026-11-14' }],
};
const ist = (day, hm) => Date.parse(`${day}T${hm}:00+05:30`);
const window = (day, hm) => [ist(day, hm) - 15 * 60000, ist(day, hm)];

describe('enrol nudges', () => {
  it('5 days before orientation at 1 PM IST', () => {
    const [fire] = enrolNudgeFires(batch, ...window('2026-11-07', '13:05'));
    expect(fire.event.code).toBe('ENROL-5D');
    expect(fire.dedupeKey).toBe('b14|ENROL-5D|2026-11-07');
  });
  it('2 days before orientation at 1 PM IST', () => {
    expect(enrolNudgeFires(batch, ...window('2026-11-10', '13:05'))[0].event.code).toBe('ENROL-2D');
  });
  it('nothing at any other time', () => {
    expect(enrolNudgeFires(batch, ...window('2026-11-07', '09:00'))).toEqual([]);
    expect(enrolNudgeFires(batch, ...window('2026-11-08', '13:05'))).toEqual([]);
  });
  it('a batch with no orientation date sends nothing; the batch date is the fallback', () => {
    expect(enrolNudgeFires({ id: 'x', sessions: [] }, ...window('2026-11-07', '13:05'))).toEqual([]);
    expect(orientationDay({ orientationDate: '2026-11-12' })).toBe('2026-11-12');
  });
  it('a cancelled orientation session is not used', () => {
    expect(orientationDay({ sessions: [{ code: 'S0', date: '2026-11-12', cancelled: true }] })).toBe('');
  });
  it('only part-paid learners', () => {
    expect(wantsEnrolNudge({ programAccess: { lep: { paymentStatus: 'register' } } })).toBe(true);
    expect(wantsEnrolNudge({ programAccess: { lep: { paymentStatus: 'paid' } } })).toBe(false);
    expect(wantsEnrolNudge({})).toBe(false);
  });
  it('text fits the lock screen: title 40, body 80 with a long first name', () => {
    for (const n of NUDGES) {
      expect(n.title.length).toBeLessThanOrEqual(40);
      expect(n.body.replace('{{name}}', 'Rajalakshmi').length).toBeLessThanOrEqual(80);
      expect(n.body).not.toMatch(/₹|\d{3,}/);
    }
  });
});
