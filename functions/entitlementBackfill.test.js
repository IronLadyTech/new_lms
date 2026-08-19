import { describe, it, expect } from 'vitest';
import accessTiers from './accessTiers.js';

const { needsEntitlementBackfill, enrolledProgramIds, programPaymentStatus } = accessTiers;

/**
 * Who the backfill touches.
 *
 * This selector decides which live learner records a bulk job rewrites, so it
 * has to be exact in both directions. Too wide and it burns Zoho API credits
 * re-provisioning people who are already correct; too narrow and learners keep
 * content they have not paid for, which is the bug it exists to close.
 *
 * The shape it hunts is the pre-per-programme one: a flat paymentStatus and no
 * programAccess entry. programPaymentStatus falls back to the flat value, so
 * such a profile reads as fully paid for every programme it is enrolled in.
 */

const stale = (over = {}) => ({
  email: 'learner@example.com',
  program: '100bm',
  paymentStatus: 'paid',
  ...over,
});

describe('backfill selector · profiles that need it', () => {
  it('picks up a flat paid profile with no per-programme entry', () => {
    const p = stale();
    // The over-grant this exists to stop, stated directly.
    expect(programPaymentStatus(p, '100bm')).toBe('paid');
    expect(needsEntitlementBackfill(p)).toBe(true);
  });

  it('picks up a flat register profile too', () => {
    // Registration tier still leaks across programmes by the same fallback.
    expect(needsEntitlementBackfill(stale({ paymentStatus: 'register' }))).toBe(true);
  });

  it('picks up a profile where only some programmes were fixed', () => {
    const p = stale({
      programs: ['100bm', 'lep'],
      programAccess: { '100bm': { paymentStatus: 'paid' } },
    });
    expect(needsEntitlementBackfill(p)).toBe(true);
  });
});

describe('backfill selector · profiles it must leave alone', () => {
  it('skips a profile already carrying its own per-programme status', () => {
    const p = stale({ programAccess: { '100bm': { paymentStatus: 'register' } } });
    expect(needsEntitlementBackfill(p)).toBe(false);
  });

  it('skips flat unpaid — the fallback grants nothing to correct', () => {
    for (const s of ['unpaid', 'failed', 'refunded', null, undefined, '']) {
      expect(needsEntitlementBackfill(stale({ paymentStatus: s })), String(s)).toBe(false);
    }
  });

  it('skips a profile enrolled in nothing', () => {
    expect(needsEntitlementBackfill({ email: 'a@b.com', paymentStatus: 'paid' })).toBe(false);
  });

  it('skips a profile with no email — there is nothing to look up in Zoho', () => {
    expect(needsEntitlementBackfill(stale({ email: '' }))).toBe(false);
  });

  it('does not throw on any malformed profile', () => {
    for (const p of [null, undefined, {}, [], { programs: 'not-an-array' }, { program: 42 }]) {
      expect(() => needsEntitlementBackfill(p)).not.toThrow();
      expect(needsEntitlementBackfill(p)).toBe(false);
    }
  });
});

describe('backfill selector · it converges', () => {
  it('stops selecting a profile once a real sync has written the entry', () => {
    /*
     * A backfill that never goes quiet would re-provision the same cohort on
     * every run and burn Zoho credits forever.
     */
    const before = stale({ programs: ['100bm', 'lep'] });
    expect(needsEntitlementBackfill(before)).toBe(true);

    const after = {
      ...before,
      programAccess: {
        '100bm': { paymentStatus: 'register' },
        lep: { paymentStatus: 'paid' },
      },
    };
    expect(needsEntitlementBackfill(after)).toBe(false);
  });
});

describe('enrolled programmes', () => {
  it('merges the single programme and the list without duplicates', () => {
    expect(enrolledProgramIds({ program: '100bm', programs: ['100bm', 'lep'] })).toEqual([
      '100bm',
      'lep',
    ]);
  });

  it('normalises the long course names Zoho sends', () => {
    expect(enrolledProgramIds({ programs: ['100 Board Members Program'] })).toEqual(['100bm']);
  });

  it('drops anything it cannot recognise rather than guessing', () => {
    expect(enrolledProgramIds({ programs: ['Executive Bootcamp', null, ''] })).toEqual([]);
  });
});
