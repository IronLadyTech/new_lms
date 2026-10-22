import { describe, it, expect } from 'vitest';
import { buildStitchHomeDashboard } from './stitchHomeDashboardService';
import { getStaticTasks } from './lepService';
import { PROGRAMS } from '../data/programTypes';
import { PAYMENT_STATUS } from '../data/accessTiers';
import { SUBMISSION_STATUS } from './mbwService';
import { computeSectionProgress } from '../utils/lepProgramUtils';

/**
 * Who gets asked to pay.
 *
 * Payment decides eligibility, finishing a phase decides progression. The
 * banner fired on registration tier alone, so it sat on the dashboard of 379 of
 * 500 learners — most of them weeks away from the first paid gate, being told
 * to pay for a wall they had not reached. Nothing failed loudly; it just nagged
 * the majority forever.
 *
 * LEP is the case with real data behind it: orientation through Day 3 are open
 * on the registration amount, Day 4 onward carry `requiresPaid`.
 */

const COURSES = [
  { id: 'c-lep', code: 'LEP', title: 'Leadership Essentials Program', description: 'LEP.' },
];

const LEP_TASKS = getStaticTasks();

/** Phases open on the registration amount, in the order they unlock.
 *  The paid wall now starts at Week 1; before the restructure it started after
 *  Day 3. */
const FREE_PHASES = ['pre-program', 'orientation', 'day-1', 'day-2'];

/** Task states with every task in `donePhases` submitted, the rest untouched. */
function lepStates(donePhases) {
  const done = new Set(donePhases);
  return LEP_TASKS.map((task) => ({
    task,
    status: done.has(task.phase) ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.UNLOCKED,
    isComplete: done.has(task.phase),
  }));
}

function banner(profile, engines = {}) {
  return buildStitchHomeDashboard({
    user: { uid: 'u1', displayName: 'Test Learner' },
    profile,
    role: 'student',
    courses: COURSES,
    engines,
  }).paymentBanner;
}

const lepProfile = (paymentStatus) => ({
  programs: [PROGRAMS.LEP],
  programAccess: { [PROGRAMS.LEP]: { paymentStatus } },
});

const registered = (donePhases) =>
  banner(lepProfile(PAYMENT_STATUS.REGISTER), { lep: { taskStates: lepStates(donePhases) } });

describe('the payment banner only speaks when payment is the blocker', () => {
  it('stays quiet for a registration-tier learner who has not reached the paid gate', () => {
    // Day 4 is locked, but by Day 3 being unfinished — not by money.
    expect(registered(['orientation']).show).toBe(false);
  });

  it('stays quiet part-way through the free phases', () => {
    expect(registered(FREE_PHASES.slice(0, 3)).show).toBe(false);
  });

  it('ignores side sections that are gated on payment with nothing in front of them', () => {
    // "community" and "weekly-progress" carry a paid gate but no sequence, so
    // they are payment-locked from day one. Treating any payment-locked section
    // as a reason to ask would put the prompt straight back on every
    // registration-tier learner, which is the whole bug. First assert the trap
    // is really in the data, so this cannot pass by the fixture drifting.
    const states = lepStates(['orientation']);
    const asIs = computeSectionProgress(states, lepProfile(PAYMENT_STATUS.REGISTER));
    const asPaid = computeSectionProgress(states, lepProfile(PAYMENT_STATUS.PAID));
    const flipped = Object.keys(asPaid).filter((id) => asPaid[id]?.unlocked && !asIs[id]?.unlocked);
    expect(flipped).toContain('community');

    expect(registered(['orientation']).show).toBe(false);
  });

  it('asks for payment once the free phases are done and only money is left', () => {
    const b = registered(FREE_PHASES);
    expect(b.show).toBe(true);
    expect(b.title).toMatch(/LEP/);
    expect(b.ctaLabel).toBe('Complete payment');
  });

  it('never asks a fully paid learner', () => {
    const b = banner(lepProfile(PAYMENT_STATUS.PAID), {
      lep: { taskStates: lepStates(FREE_PHASES) },
    });
    expect(b.show).toBe(false);
  });

  it('asks an unpaid learner straight away, because nothing is open to them', () => {
    // Not the same case: registration tier owns Phase 1, unpaid owns nothing.
    const b = banner(lepProfile(PAYMENT_STATUS.UNPAID), { lep: { taskStates: lepStates([]) } });
    expect(b.show).toBe(true);
    expect(b.subtitle).toMatch(/complete the required payment/i);
  });

  it('says nothing before the task engine has loaded', () => {
    // An empty engine is "not known yet", not "nothing is blocked".
    expect(banner(lepProfile(PAYMENT_STATUS.REGISTER), {}).show).toBe(false);
  });

  it('does not let one programme paying for itself silence another', () => {
    // asFullyPaid clones the profile; a leak into the real one would make the
    // next programme look paid.
    const profile = {
      programs: [PROGRAMS.LEP],
      programAccess: { [PROGRAMS.LEP]: { paymentStatus: PAYMENT_STATUS.REGISTER } },
    };
    banner(profile, { lep: { taskStates: lepStates(FREE_PHASES) } });
    expect(profile.programAccess[PROGRAMS.LEP].paymentStatus).toBe(PAYMENT_STATUS.REGISTER);
  });
});
