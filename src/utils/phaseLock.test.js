import { describe, it, expect } from 'vitest';
import { asFullyPaid, buildPhaseLockReason, LOCKED_BY } from './phaseLock';
import { getUnlockedPhaseIds } from './lepProgramUtils';
import { getStaticTasks } from '../services/lepService';
import { SUBMISSION_STATUS } from '../services/mbwService';
import { PROGRAMS } from '../data/programTypes';
import { PAYMENT_STATUS } from '../data/accessTiers';

/**
 * Why a phase is shut.
 *
 * Both task engines used to answer "payment" for every locked phase, because
 * `resolveGate` returns one boolean for two different reasons. The result was
 * that a learner who had paid in full, and was simply part-way through the
 * phase before, opened a lesson and was told to complete her payment. She had
 * nothing left to pay.
 */

const TASKS = getStaticTasks();

function states(donePhases) {
  const done = new Set(donePhases);
  return TASKS.map((task) => ({
    task,
    status: done.has(task.phase) ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.UNLOCKED,
    isComplete: done.has(task.phase),
  }));
}

const profile = (paymentStatus) => ({
  programs: [PROGRAMS.LEP],
  programAccess: { [PROGRAMS.LEP]: { paymentStatus } },
});

const reasonFor = (donePhases, paymentStatus) =>
  buildPhaseLockReason(
    getUnlockedPhaseIds,
    states(donePhases),
    profile(paymentStatus),
    PROGRAMS.LEP
  );

describe('asFullyPaid', () => {
  it('marks the one programme paid without touching the learner', () => {
    const original = profile(PAYMENT_STATUS.REGISTER);
    const copy = asFullyPaid(original, PROGRAMS.LEP);
    expect(copy.programAccess[PROGRAMS.LEP].paymentStatus).toBe(PAYMENT_STATUS.PAID);
    // The real profile is untouched, or the next programme would look paid too.
    expect(original.programAccess[PROGRAMS.LEP].paymentStatus).toBe(PAYMENT_STATUS.REGISTER);
  });

  it('drops the paid-on date rather than inventing one', () => {
    // A missing date reads as "no expiry known", which is what this question
    // wants; a made-up one could put the learner inside or outside a window.
    expect(
      asFullyPaid(profile(PAYMENT_STATUS.REGISTER), PROGRAMS.LEP).programAccess.lep.fullPaidAt
    ).toBeNull();
  });

  it('leaves other programmes alone', () => {
    const both = {
      programAccess: {
        [PROGRAMS.LEP]: { paymentStatus: PAYMENT_STATUS.REGISTER },
        [PROGRAMS.BM100]: { paymentStatus: PAYMENT_STATUS.REGISTER },
      },
    };
    const copy = asFullyPaid(both, PROGRAMS.LEP);
    expect(copy.programAccess[PROGRAMS.BM100].paymentStatus).toBe(PAYMENT_STATUS.REGISTER);
  });
});

describe('why a phase is locked', () => {
  it('says nothing about a phase that is open', () => {
    expect(reasonFor(['pre-program'], PAYMENT_STATUS.PAID)('orientation')).toBeNull();
  });

  it('blames progression, not money, when the learner has paid in full', () => {
    /* The exact case seen in the app: LEP paid, Pre-Program part-finished, and
       the Orientation lesson said "this section needs full program payment". */
    const why = reasonFor([], PAYMENT_STATUS.PAID);
    expect(why('orientation')).toBe(LOCKED_BY.SEQUENCE);
  });

  it('blames progression for a paid learner deep in the programme too', () => {
    const why = reasonFor(['pre-program', 'orientation', 'day-1'], PAYMENT_STATUS.PAID);
    expect(why('week-1')).toBe(LOCKED_BY.SEQUENCE);
  });

  it('blames money only when money is what is missing', () => {
    // Everything free is finished, so Week 1 waits on payment alone.
    const why = reasonFor(
      ['pre-program', 'orientation', 'day-1', 'day-2'],
      PAYMENT_STATUS.REGISTER
    );
    expect(why('week-1')).toBe(LOCKED_BY.PAYMENT);
  });

  it('still blames progression when both are outstanding', () => {
    /* Week 2 needs payment *and* Week 1 finished. Paying would not open it, so
       telling her to pay would send her to do something that does not help. */
    const why = reasonFor(
      ['pre-program', 'orientation', 'day-1', 'day-2'],
      PAYMENT_STATUS.REGISTER
    );
    expect(why('week-2')).toBe(LOCKED_BY.SEQUENCE);
  });
});
