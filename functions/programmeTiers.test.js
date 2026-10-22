import { describe, it, expect } from 'vitest';
import provisioning from './zohoProvisioning.js';

const { tiersFromProgrammeLists } = provisioning;

/**
 * Reading the tier instead of guessing it.
 *
 * Zoho states this outright on IL Users: a programme in
 * Program_Registration_Details has had its registration fee paid, one in
 * Program_Enrollment_Details has been paid in full. The LMS used to
 * reconstruct the same answer from Lead Status text on Leads — the module that
 * auto-creates a duplicate on every conversion — which is how a learner
 * registered for two programmes and enrolled in one ended up with a single flat
 * tier covering both.
 *
 * The case below is a real record, read from production while tracing why one
 * learner's 100BM content was unlocked.
 */

describe('the real record that started this', () => {
  const record = {
    Program_Registration_Details: 'Leadership Essentials Program,100 Board Members Program',
    Program_Enrollment_Details: 'Leadership Essentials Program',
  };

  it('gives full access to the enrolled programme and partial to the other', () => {
    expect(tiersFromProgrammeLists(record)).toEqual({
      lep: 'paid',
      '100bm': 'register',
    });
  });

  it('does not let the higher tier leak across programmes', () => {
    // The defect in one line: paying LEP in full must not unlock 100BM.
    expect(tiersFromProgrammeLists(record)['100bm']).not.toBe('paid');
  });
});

describe('the two lists', () => {
  it('reads registration as partial', () => {
    expect(tiersFromProgrammeLists({ Program_Registration_Details: 'Master of Business Warfare' })).toEqual({
      mbw: 'paid'.replace('paid', 'register'),
    });
  });

  it('reads enrolment as full', () => {
    expect(tiersFromProgrammeLists({ Program_Enrollment_Details: 'Master of Business Warfare' })).toEqual({
      mbw: 'paid',
    });
  });

  it('lets enrolment win when a programme is in both', () => {
    /*
     * Registration is never removed when somebody goes on to pay in full, so
     * both lists naming the same programme is the normal fully-paid shape — not
     * a conflict.
     */
    const tiers = tiersFromProgrammeLists({
      Program_Registration_Details: 'Leadership Essentials Program',
      Program_Enrollment_Details: 'Leadership Essentials Program',
    });
    expect(tiers).toEqual({ lep: 'paid' });
  });

  it('handles all three programmes at once', () => {
    expect(
      tiersFromProgrammeLists({
        Program_Registration_Details: 'LEP,100BM,MBW',
        Program_Enrollment_Details: 'MBW',
      })
    ).toEqual({ lep: 'register', '100bm': 'register', mbw: 'paid' });
  });

  it('copes with the spacing Zoho actually sends', () => {
    expect(
      tiersFromProgrammeLists({
        Program_Registration_Details: ' Leadership Essentials Program , 100 Board Members Program ',
      })
    ).toEqual({ lep: 'register', '100bm': 'register' });
  });
});

describe('when Zoho says nothing', () => {
  it('returns null rather than an empty answer', () => {
    /*
     * The distinction the caller depends on. An empty object would read as
     * "Zoho says this learner has no programmes" and could revoke access; null
     * means "this record carries no opinion", so the Lead Status reading stands.
     */
    for (const record of [
      {},
      null,
      undefined,
      { Program_Registration_Details: '', Program_Enrollment_Details: '' },
      { Program_Registration_Details: null },
    ]) {
      expect(tiersFromProgrammeLists(record)).toBeNull();
    }
  });

  it('returns null when the lists name nothing recognisable', () => {
    // A stray value must not become a programme id nothing can ever satisfy.
    expect(tiersFromProgrammeLists({ Program_Registration_Details: 'Executive Bootcamp' })).toBeNull();
  });

  it('keeps the programmes it recognises and drops the rest', () => {
    expect(
      tiersFromProgrammeLists({ Program_Registration_Details: 'Executive Bootcamp,MBW' })
    ).toEqual({ mbw: 'register' });
  });
});

describe('malformed input', () => {
  it('does not throw on anything a record might contain', () => {
    for (const bad of [
      { Program_Registration_Details: 42 },
      { Program_Enrollment_Details: [] },
      { Program_Registration_Details: {} },
      { Program_Registration_Details: ',,,' },
    ]) {
      expect(() => tiersFromProgrammeLists(bad)).not.toThrow();
    }
  });
});

describe('enrichRecordWithAllZohoEnrollments keeps IL Users lists separate', () => {
  const { enrichRecordWithAllZohoEnrollments } = provisioning;

  it('puts IL Users enrolment into enrolment, not registration', () => {
    const enriched = enrichRecordWithAllZohoEnrollments(
      { Program_Registration_Details: 'Leadership Essentials Program' },
      {
        ilUsers: [
          {
            Program_Registration_Details: 'Leadership Essentials Program',
            Program_Enrollment_Details: 'Master of Business Warfare',
          },
        ],
      }
    );
    expect(tiersFromProgrammeLists(enriched)).toEqual({
      lep: 'register',
      mbw: 'paid',
    });
  });
});
