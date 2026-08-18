import { describe, it, expect } from 'vitest';
import {
  isRegistrationPaymentLocked,
  getSectionLockDisplay,
  computeSectionProgress,
  hasRegistrationTierOnly,
} from '../utils/bm100ProgramUtils';
import { BM100_PROGRAM_SECTIONS } from './bm100ProgramStructure';
import { canAccessProgram, getProgramAccessState } from '../utils/programAccess';
import { hasFullProgramAccess, programPaymentStatus, PAYMENT_STATUS } from './accessTiers';
import { isProgramAccessExpired } from './programAccessWindow';
import { PROGRAMS } from './programTypes';

/**
 * The access state machine, in one place.
 *
 * Access is decided by four independent inputs and a section opens only when
 * all four agree:
 *
 *   1 enrolment  — is this programme theirs at all
 *   2 tier       — how much of it is theirs (unpaid | register | paid)
 *   3 window     — is it still theirs (expiry)
 *   4 sequence   — have they earned it (prior sections complete)
 *
 * Previous suites tested these one at a time, in the codebase's own vocabulary,
 * so two whole classes of defect were invisible: a Zoho word nobody had taught
 * the parser, and a combination of inputs nobody had put together. Both shipped.
 *
 * Every payment value below is a literal string Zoho actually sends, counted
 * from live profiles on 2026-08-17: paid 267 · completed 157 · register 60 ·
 * unpaid 14 · failed 2. Nothing here uses PAYMENT_STATUS.* as an input, because
 * feeding the code its own enum only proves it agrees with itself.
 */

const PAID_SECTION = BM100_PROGRAM_SECTIONS.find((s) => s.gate?.requiresPaid);
const FREE_SECTION = BM100_PROGRAM_SECTIONS.find((s) => !s.gate?.requiresPaid);
const LOCKED_PROGRESS = { [PAID_SECTION.id]: { unlocked: false } };

/** A profile shaped the way provisioning writes one. */
function learner({ tier = null, programme = PROGRAMS.BM100, paidAt = null, flat = null } = {}) {
  const profile = { email: 'a@b.com', role: 'student', enrolledCourses: [] };
  if (flat) profile.paymentStatus = flat;
  if (tier) {
    profile.programAccess = { [programme]: { paymentStatus: tier } };
    if (paidAt) profile.programAccess[programme].fullPaidAt = paidAt;
  }
  return profile;
}

/* ────────────────────────────────────────────────────────────────────────────
   INPUT 2 — tier, across every value production actually sends
   ──────────────────────────────────────────────────────────────────────────── */

describe('tier · every payment word Zoho sends', () => {
  const cases = [
    ['paid', true, 'the full programme fee cleared'],
    ['completed', false, 'the REGISTRATION transaction completed, not the programme fee'],
    ['register', false, 'registration fee only'],
    ['unpaid', false, 'nothing paid'],
    ['failed', false, 'the payment did not succeed'],
    ['refunded', false, 'money returned'],
    ['cancelled', false, 'transaction abandoned'],
    ['awaiting_settlement', false, 'a word this code has never been taught'],
    ['', false, 'blank'],
    [undefined, false, 'absent — every freshly created account'],
  ];

  it.each(cases)('%s → full access: %s (%s)', (value, expected) => {
    expect(hasFullProgramAccess(learner({ tier: value, flat: value }))).toBe(expected);
  });

  it('an unknown word denies rather than grants', () => {
    /*
     * The direction matters more than the value. A wrongly withheld section
     * produces a support ticket; a wrongly granted one produces silence, and
     * that is how 159 of 500 learners reached paid content unnoticed.
     */
    for (const invented of ['settled', 'processing', 'part_paid', 'PAID_LATER', 'null']) {
      expect(hasFullProgramAccess(learner({ tier: invented })), invented).toBe(false);
    }
  });

  it('case and whitespace do not change the answer', () => {
    for (const v of ['PAID', ' paid ', 'Paid']) {
      expect(hasFullProgramAccess(learner({ tier: v }), PROGRAMS.BM100), v).toBe(true);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   INPUT 2b — tier is per programme, not per learner
   ──────────────────────────────────────────────────────────────────────────── */

describe('tier · isolation between programmes', () => {
  const twoProgrammes = {
    paymentStatus: 'paid',
    programAccess: {
      [PROGRAMS.LEP]: { paymentStatus: 'paid' },
      [PROGRAMS.BM100]: { paymentStatus: 'register' },
    },
  };

  it('answers for the programme asked about', () => {
    expect(programPaymentStatus(twoProgrammes, PROGRAMS.LEP)).toBe(PAYMENT_STATUS.PAID);
    expect(programPaymentStatus(twoProgrammes, PROGRAMS.BM100)).toBe(PAYMENT_STATUS.REGISTER);
  });

  it('paying for one programme does not unlock another', () => {
    expect(hasFullProgramAccess(twoProgrammes, PROGRAMS.LEP)).toBe(true);
    expect(hasFullProgramAccess(twoProgrammes, PROGRAMS.BM100)).toBe(false);
  });

  it('a programme with no entry falls back to the flat field', () => {
    // Every learner provisioned before per-programme payment existed. They must
    // keep the access they had, not lose it the day the change ships.
    expect(programPaymentStatus(twoProgrammes, PROGRAMS.MBW)).toBe(PAYMENT_STATUS.PAID);
    expect(hasFullProgramAccess({ paymentStatus: 'paid' }, PROGRAMS.BM100)).toBe(true);
    expect(hasFullProgramAccess({ paymentStatus: 'register' }, PROGRAMS.BM100)).toBe(false);
  });

  it('the registration-tier flag is scoped too', () => {
    expect(hasRegistrationTierOnly(twoProgrammes)).toBe(true);
    expect(hasRegistrationTierOnly({ paymentStatus: 'paid' })).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   INPUT 3 — the access window
   ──────────────────────────────────────────────────────────────────────────── */

describe('window · expiry boundaries', () => {
  const paidAt = '2026-08-18T00:00:00.000Z'; // 100BM window is 18 months

  it.each([
    ['one day before it closes', '2028-02-17T23:59:00.000Z', false],
    ['the instant it closes', '2028-02-18T00:00:00.000Z', true],
    ['long after', '2030-01-01T00:00:00.000Z', true],
    ['before it even started', '2026-01-01T00:00:00.000Z', false],
  ])('%s → expired: %s', (_label, now, expected) => {
    const p = learner({ tier: 'paid', paidAt });
    expect(isProgramAccessExpired(p, PROGRAMS.BM100, new Date(now))).toBe(expected);
  });

  it('an unknown payment date never expires anybody', () => {
    // The safety property. Absence of a date must read as "no window known",
    // never as "expired" — otherwise enabling expiry locks out everyone who
    // paid before it was recorded.
    const p = learner({ tier: 'paid' });
    expect(isProgramAccessExpired(p, PROGRAMS.BM100, new Date('2099-01-01'))).toBe(false);
  });

  it('one programme expiring leaves another alone', () => {
    const p = {
      paymentStatus: 'paid',
      programAccess: {
        [PROGRAMS.LEP]: { paymentStatus: 'paid', fullPaidAt: '2026-01-10T00:00:00.000Z' },
        [PROGRAMS.BM100]: { paymentStatus: 'paid', fullPaidAt: '2026-08-18T00:00:00.000Z' },
      },
    };
    const now = new Date('2027-06-01T00:00:00.000Z'); // LEP closed Feb 2027
    expect(isProgramAccessExpired(p, PROGRAMS.LEP, now)).toBe(true);
    expect(isProgramAccessExpired(p, PROGRAMS.BM100, now)).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   INPUT 1 — enrolment
   ──────────────────────────────────────────────────────────────────────────── */

describe('enrolment · which programmes are theirs', () => {
  const courses = [
    { id: 'c-lep', code: 'LEP' },
    { id: 'c-bm', code: '100BM' },
    { id: 'c-mbw', code: 'MBW' },
  ];

  it('a brand-new account is enrolled in nothing', () => {
    // Self sign-up creates an empty shell. Paying is not what enrols somebody.
    const fresh = { email: 'x@y.com', role: 'student', enrolledCourses: [] };
    expect(canAccessProgram('100BM', fresh, courses)).toBe(false);
    expect(canAccessProgram('LEP', fresh, courses)).toBe(false);
  });

  it('recognises enrolment from each of the three sources independently', () => {
    expect(canAccessProgram('100BM', { enrolledCourses: ['c-bm'] }, courses)).toBe(true);
    expect(canAccessProgram('100BM', { program: '100bm' }, courses)).toBe(true);
    expect(canAccessProgram('100BM', { programs: ['100bm'] }, courses)).toBe(true);
  });

  it('accepts both the id and the code for the same programme', () => {
    expect(canAccessProgram('100bm', { program: '100BM' }, courses)).toBe(true);
    expect(canAccessProgram('100BM', { program: '100bm' }, courses)).toBe(true);
  });

  it('paying for a programme does not enrol anybody in it', () => {
    // The two are independent. Zoho grants enrolment; payment only sets tier.
    const paidButNotEnrolled = { paymentStatus: 'paid', enrolledCourses: [] };
    expect(canAccessProgram('100BM', paidButNotEnrolled, courses)).toBe(false);
  });

  it('does not cascade down the journey', () => {
    // Being in MBW must not imply LEP or 100BM — access is strict enrolment.
    const mbwOnly = { program: 'mbw' };
    expect(canAccessProgram('MBW', mbwOnly, courses)).toBe(true);
    expect(canAccessProgram('100BM', mbwOnly, courses)).toBe(false);
    expect(canAccessProgram('LEP', mbwOnly, courses)).toBe(false);
  });

  it('labels the next programme upcoming and the rest locked', () => {
    const lepOnly = { program: 'lep' };
    expect(getProgramAccessState('LEP', lepOnly, courses).state).toBe('open');
    expect(getProgramAccessState('100BM', lepOnly, courses).state).toBe('upcoming');
    expect(getProgramAccessState('MBW', lepOnly, courses).state).toBe('locked');
  });

  it('survives a missing or malformed profile without throwing', () => {
    for (const bad of [null, undefined, {}, { enrolledCourses: null }, { programs: 'lep' }]) {
      expect(() => canAccessProgram('100BM', bad, courses)).not.toThrow();
      expect(canAccessProgram('100BM', bad, courses)).toBe(false);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   COMBINATIONS — what the learner actually sees
   ──────────────────────────────────────────────────────────────────────────── */

describe('combined · what a section shows', () => {
  /*
   * The table nobody had written. Each row is a real learner state; the columns
   * are the three things the UI decides. The padlock rule is the one that was
   * wrong most recently: it means money, not progress, so a fully paid learner
   * waiting on earlier work must not see one.
   */
  const rows = [
    {
      state: 'registration tier',
      profile: () => learner({ tier: 'register' }),
      padlock: true,
      expired: false,
      mentions: /registration amount/i,
    },
    {
      state: 'registration via the legacy flat field',
      profile: () => ({ paymentStatus: 'register' }),
      padlock: true,
      expired: false,
      mentions: /registration amount/i,
    },
    {
      state: 'failed payment',
      profile: () => learner({ tier: 'failed' }),
      padlock: true,
      expired: false,
      mentions: /registration amount/i,
    },
    {
      state: 'unknown status',
      profile: () => learner({ tier: 'awaiting_settlement' }),
      padlock: true,
      expired: false,
      mentions: /registration amount/i,
    },
    {
      state: 'paid, window open, sequence pending',
      profile: () => learner({ tier: 'paid', paidAt: '2026-08-01T00:00:00.000Z' }),
      padlock: false,
      expired: false,
      mentions: /complete .* to unlock/i,
    },
    {
      state: 'paid, window closed',
      profile: () => learner({ tier: 'paid', paidAt: '2024-01-01T00:00:00.000Z' }),
      padlock: true,
      expired: true,
      mentions: /has ended/i,
    },
  ];

  it.each(rows)('$state', ({ profile, padlock, expired, mentions }) => {
    const p = profile();
    const display = getSectionLockDisplay(PAID_SECTION, LOCKED_PROGRESS, p);
    const paymentLocked = isRegistrationPaymentLocked(PAID_SECTION, LOCKED_PROGRESS, p);

    expect(display).toBeTruthy();
    expect(display.message).toMatch(mentions);
    expect(Boolean(display.expired)).toBe(expired);
    expect(paymentLocked || Boolean(display.expired)).toBe(padlock);
  });

  it('never tells a paid learner they owe money', () => {
    // The defect this replaces: a fully paid learner saw "full program payment
    // required" on the lessons of a section merely waiting on earlier work.
    const paid = learner({ tier: 'paid', paidAt: '2026-08-01T00:00:00.000Z' });
    const display = getSectionLockDisplay(PAID_SECTION, LOCKED_PROGRESS, paid);
    expect(display.message).not.toMatch(/payment/i);
  });

  it('never padlocks a section that has no payment gate', () => {
    const unpaid = learner({ tier: 'unpaid' });
    const progress = { [FREE_SECTION.id]: { unlocked: false } };
    expect(isRegistrationPaymentLocked(FREE_SECTION, progress, unpaid)).toBe(false);
  });

  it('says nothing at all about an unlocked section', () => {
    const paid = learner({ tier: 'paid' });
    const unlocked = { [PAID_SECTION.id]: { unlocked: true } };
    expect(getSectionLockDisplay(PAID_SECTION, unlocked, paid)).toBeNull();
    expect(isRegistrationPaymentLocked(PAID_SECTION, unlocked, paid)).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   STATE TRANSITIONS — the sequence a real learner moves through
   ──────────────────────────────────────────────────────────────────────────── */

describe('transitions · a learner moving through the pipeline', () => {
  const tasks = BM100_PROGRAM_SECTIONS.flatMap((s, si) =>
    s.usesTaskEngine
      ? [
          {
            task: { id: `${s.id}-t`, phase: s.id, order: si * 10, title: 't' },
            status: 'approved',
            isComplete: true,
          },
        ]
      : []
  );

  const paidSectionUnlocked = (profile) =>
    computeSectionProgress(tasks, profile)[PAID_SECTION.id]?.unlocked;

  it('unpaid → register → paid widens access and never narrows it', () => {
    expect(paidSectionUnlocked(learner({ tier: 'unpaid' }))).toBe(false);
    expect(paidSectionUnlocked(learner({ tier: 'register' }))).toBe(false);
    // At paid the payment gate stops blocking; sequence may still.
    expect(hasFullProgramAccess(learner({ tier: 'paid' }), PROGRAMS.BM100)).toBe(true);
  });

  it('a refund returns the learner to locked', () => {
    const refunded = {
      paymentStatus: 'unpaid',
      programAccess: {
        [PROGRAMS.BM100]: {
          paymentStatus: 'unpaid',
          fullPaidAt: null,
          refundedAt: '2026-08-18T00:00:00.000Z',
        },
      },
    };
    expect(hasFullProgramAccess(refunded, PROGRAMS.BM100)).toBe(false);
    expect(isRegistrationPaymentLocked(PAID_SECTION, LOCKED_PROGRESS, refunded)).toBe(true);
  });

  it('a refunded programme does not disturb a surviving one', () => {
    const mixed = {
      paymentStatus: 'paid',
      programAccess: {
        [PROGRAMS.LEP]: { paymentStatus: 'paid' },
        [PROGRAMS.BM100]: { paymentStatus: 'unpaid', refundedAt: '2026-08-18T00:00:00.000Z' },
      },
    };
    expect(hasFullProgramAccess(mixed, PROGRAMS.LEP)).toBe(true);
    expect(hasFullProgramAccess(mixed, PROGRAMS.BM100)).toBe(false);
  });
});
