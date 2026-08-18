import { describe, it, expect } from 'vitest';
import {
  accessMonthsFor,
  accessExpiresAt,
  isAccessExpired,
  daysUntilExpiry,
  fullPaidAtFor,
  isProgramAccessExpired,
} from './programAccessWindow';
import { PROGRAMS } from './programTypes';

/*
 * The rule, from the team: the programme's own length plus a year, counted from
 * the day the full course amount is confirmed — LEP 1+12, 100BM 6+12, MBW
 * 12+12.
 */
describe('accessMonthsFor', () => {
  it('adds a year to each programme length', () => {
    expect(accessMonthsFor(PROGRAMS.LEP)).toBe(13);
    expect(accessMonthsFor(PROGRAMS.BM100)).toBe(18);
    expect(accessMonthsFor(PROGRAMS.MBW)).toBe(24);
  });

  it('says nothing about a programme it does not know', () => {
    expect(accessMonthsFor('unknown')).toBeNull();
    expect(accessMonthsFor(undefined)).toBeNull();
  });
});

describe('accessExpiresAt', () => {
  it('counts from the day full payment completed', () => {
    const paid = '2026-08-18T00:00:00.000Z';
    expect(accessExpiresAt(PROGRAMS.LEP, paid).toISOString()).toBe('2027-09-18T00:00:00.000Z');
    expect(accessExpiresAt(PROGRAMS.BM100, paid).toISOString()).toBe('2028-02-18T00:00:00.000Z');
    expect(accessExpiresAt(PROGRAMS.MBW, paid).toISOString()).toBe('2028-08-18T00:00:00.000Z');
  });

  it('keeps a month-end payment inside the target month', () => {
    // Naive month arithmetic turns 31 Jan + 1 month into 2 March.
    const end = accessExpiresAt(PROGRAMS.LEP, '2026-01-31T00:00:00.000Z');
    expect(end.toISOString().slice(0, 10)).toBe('2027-02-28');
  });

  it('accepts a Firestore Timestamp as readily as an ISO string', () => {
    const iso = '2026-08-18T00:00:00.000Z';
    const stamp = { toDate: () => new Date(iso) };
    expect(accessExpiresAt(PROGRAMS.MBW, stamp).toISOString()).toBe(
      accessExpiresAt(PROGRAMS.MBW, iso).toISOString()
    );
  });

  it('returns nothing when there is no payment date', () => {
    expect(accessExpiresAt(PROGRAMS.LEP, null)).toBeNull();
    expect(accessExpiresAt(PROGRAMS.LEP, '')).toBeNull();
    expect(accessExpiresAt(PROGRAMS.LEP, 'not a date')).toBeNull();
  });
});

describe('isAccessExpired', () => {
  const paid = '2026-08-18T00:00:00.000Z';

  it('is false the day before the window closes', () => {
    expect(isAccessExpired(PROGRAMS.LEP, paid, new Date('2027-09-17T23:59:00.000Z'))).toBe(false);
  });

  it('is true once the window has closed', () => {
    expect(isAccessExpired(PROGRAMS.LEP, paid, new Date('2027-09-18T00:00:00.000Z'))).toBe(true);
    expect(isAccessExpired(PROGRAMS.BM100, paid, new Date('2028-03-01T00:00:00.000Z'))).toBe(true);
  });

  it('never expires a learner whose payment date we do not know', () => {
    /*
     * The important one. Existing learners carry no payment date yet, and an
     * unknown date must read as "no expiry known", not "expired" — otherwise
     * switching this on would lock out everyone who already paid.
     */
    expect(isAccessExpired(PROGRAMS.MBW, null, new Date('2099-01-01T00:00:00.000Z'))).toBe(false);
    expect(isAccessExpired('unknown', paid, new Date('2099-01-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('daysUntilExpiry', () => {
  it('counts the days left', () => {
    const paid = '2026-08-18T00:00:00.000Z';
    expect(daysUntilExpiry(PROGRAMS.LEP, paid, new Date('2027-09-11T00:00:00.000Z'))).toBe(7);
  });

  it('goes negative once past', () => {
    const paid = '2026-08-18T00:00:00.000Z';
    expect(daysUntilExpiry(PROGRAMS.LEP, paid, new Date('2027-09-28T00:00:00.000Z'))).toBe(-10);
  });

  it('says nothing without a payment date', () => {
    expect(daysUntilExpiry(PROGRAMS.LEP, null)).toBeNull();
  });
});

describe('reading the stamp off a profile', () => {
  const profile = {
    programAccess: {
      [PROGRAMS.LEP]: { fullPaidAt: '2026-01-10T00:00:00.000Z' },
      [PROGRAMS.BM100]: { fullPaidAt: '2026-08-18T00:00:00.000Z' },
    },
  };

  it('finds the date for each programme separately', () => {
    expect(fullPaidAtFor(profile, PROGRAMS.LEP)).toBe('2026-01-10T00:00:00.000Z');
    expect(fullPaidAtFor(profile, PROGRAMS.BM100)).toBe('2026-08-18T00:00:00.000Z');
    expect(fullPaidAtFor(profile, PROGRAMS.MBW)).toBeNull();
  });

  it('expires one programme without touching another', () => {
    // LEP window closed Feb 2027; the 100BM one runs to Feb 2028.
    const now = new Date('2027-06-01T00:00:00.000Z');
    expect(isProgramAccessExpired(profile, PROGRAMS.LEP, now)).toBe(true);
    expect(isProgramAccessExpired(profile, PROGRAMS.BM100, now)).toBe(false);
  });

  it('leaves a learner with no stamp alone', () => {
    expect(isProgramAccessExpired({}, PROGRAMS.MBW, new Date('2099-01-01'))).toBe(false);
    expect(isProgramAccessExpired(null, PROGRAMS.MBW, new Date('2099-01-01'))).toBe(false);
  });
});
