import { describe, it, expect } from 'vitest';
import { buildStitchHomeDashboard } from './stitchHomeDashboardService';
import { PROGRAMS } from '../data/programTypes';
import { PAYMENT_STATUS } from '../data/accessTiers';
import { PROGRAM_ACCESS } from '../utils/programAccess';

/**
 * The paid/unpaid split on the programme panel.
 *
 * This is covered here rather than in the browser because the only account
 * available to click through is paid on all three programmes — the unpaid
 * branch never renders there, so it would otherwise ship unverified.
 */

const COURSES = [
  { id: 'c-lep', code: 'LEP', title: 'Leadership Essentials Program', description: 'LEP blurb.' },
  { id: 'c-mbw', code: 'MBW', title: 'Master of Business Warfare', description: 'MBW blurb.' },
];

function build(profile, engines = {}) {
  return buildStitchHomeDashboard({
    user: { uid: 'u1', displayName: 'Test Learner' },
    profile,
    role: 'student',
    courses: COURSES,
    engines,
  }).programmes;
}

const find = (list, id) => list.find((p) => p.id === id);

describe('programme panel CTAs by payment status', () => {
  it('lets a fully paid learner open tasks', () => {
    const p = find(
      build({ programs: [PROGRAMS.MBW], programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } } }),
      PROGRAMS.MBW
    );
    expect(p.canOpenTasks).toBe(true);
  });

  it('keeps tasks open for a registration-tier learner', () => {
    // They have paid for phase one; gating on "not fully paid" would lock them
    // out of work they own.
    const p = find(
      build({
        programs: [PROGRAMS.MBW],
        programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.REGISTER } },
      }),
      PROGRAMS.MBW
    );
    expect(p.canOpenTasks).toBe(true);
  });

  it('sends an unpaid learner to the public page instead', () => {
    const p = find(
      build({
        programs: [PROGRAMS.MBW],
        programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.UNPAID } },
      }),
      PROGRAMS.MBW
    );
    expect(p.canOpenTasks).toBe(false);
    expect(p.href).toMatch(/^https:\/\/iamironlady\.com\//);
    expect(p.marketingUrl).toBe(p.href);
  });

  it('does not list a programme the learner has no access to at all', () => {
    expect(find(build({ programs: [] }), PROGRAMS.MBW)).toBeUndefined();
  });

  it('resumes a paid learner at the task they stopped on', () => {
    const list = build(
      { programs: [PROGRAMS.MBW], programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } } },
      { mbw: { nextTaskState: { task: { id: 'q2-buddy-rejection' } }, taskStates: [] } }
    );
    expect(find(list, PROGRAMS.MBW).href).toBe('/app/mbw?lesson=q2-buddy-rejection');
  });

  it('falls back to the programme page when no task is known', () => {
    const list = build({
      programs: [PROGRAMS.MBW],
      programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } },
    });
    expect(find(list, PROGRAMS.MBW).href).toBe('/app/mbw');
  });

  it('carries the course description through for the panel blurb', () => {
    const list = build({
      programs: [PROGRAMS.MBW],
      programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } },
    });
    expect(find(list, PROGRAMS.MBW).description).toBe('MBW blurb.');
  });

  it('leaves the milestone label empty when there is nothing to count', () => {
    const list = build({
      programs: [PROGRAMS.MBW],
      programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } },
    });
    expect(find(list, PROGRAMS.MBW).progressLabel).toBe('');
  });
});


/**
 * "Your programmes" lists only what the learner owns. The full catalogue lives
 * on Browse Courses, so upcoming and locked programmes never reach this grid.
 */
describe("programme list shows only the learner's own programmes", () => {
  const paidIn = (...ids) => ({
    programs: ids,
    programAccess: Object.fromEntries(
      ids.map((id) => [id, { paymentStatus: PAYMENT_STATUS.PAID }])
    ),
  });

  it('lists only the programmes the learner is enrolled in', () => {
    const ids = build(paidIn(PROGRAMS.MBW)).map((p) => p.id);
    expect(ids).toEqual([PROGRAMS.MBW]);
  });

  it('keeps journey order among the ones they own', () => {
    const ids = build(paidIn(PROGRAMS.MBW, PROGRAMS.LEP)).map((p) => p.id);
    expect(ids).toEqual([PROGRAMS.LEP, PROGRAMS.MBW]);
  });

  it('returns nothing when the learner is enrolled in nothing', () => {
    expect(build({ programs: [] })).toEqual([]);
  });

  it('never shows an upcoming or locked programme here', () => {
    const states = build(paidIn(PROGRAMS.LEP)).map((p) => p.state);
    expect(states).toEqual([PROGRAM_ACCESS.OPEN]);
  });

  it('still lists a registered programme the learner has not fully paid', () => {
    const p = find(
      build({
        programs: [PROGRAMS.MBW],
        programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.REGISTER } },
      }),
      PROGRAMS.MBW
    );
    expect(p).toBeTruthy();
    expect(p.canOpenTasks).toBe(true);
  });

  it('lists an enrolled-but-unpaid programme, pointing at the public page', () => {
    const p = find(
      build({
        programs: [PROGRAMS.MBW],
        programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.UNPAID } },
      }),
      PROGRAMS.MBW
    );
    expect(p).toBeTruthy();
    expect(p.canOpenTasks).toBe(false);
    expect(p.href).toMatch(/^https:\/\/iamironlady\.com\//);
  });
});
