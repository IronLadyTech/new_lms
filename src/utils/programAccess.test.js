import { describe, expect, it } from 'vitest';
import {
  PROGRAM_ACCESS,
  canAccessProgram,
  canOpenProgramTasks,
  getProgramAccessState,
  courseCodeToProgramId,
  getEnrolledProgramIds,
  getEnrolledProgramEntries,
  getProgramAccessState,
} from './programAccess.js';
import { PROGRAMS } from '../data/programTypes.js';
import { PAYMENT_STATUS } from '../data/accessTiers.js';

describe('courseCodeToProgramId', () => {
  it('maps known course codes', () => {
    expect(courseCodeToProgramId('LEP')).toBe(PROGRAMS.LEP);
    expect(courseCodeToProgramId('100BM')).toBe(PROGRAMS.BM100);
    expect(courseCodeToProgramId('MBW')).toBe(PROGRAMS.MBW);
  });

  it('returns null for unknown codes', () => {
    expect(courseCodeToProgramId('XYZ')).toBeNull();
    expect(courseCodeToProgramId('')).toBeNull();
  });
});

describe('getEnrolledProgramIds', () => {
  it('returns empty set without a profile', () => {
    expect(getEnrolledProgramIds(null).size).toBe(0);
  });

  it('includes profile.program and enrolled course codes', () => {
    const courses = [
      { id: 'c1', code: 'LEP' },
      { id: 'c2', code: 'MBW' },
    ];
    const ids = getEnrolledProgramIds(
      { program: PROGRAMS.BM100, enrolledCourses: ['c1'] },
      courses
    );
    expect(ids.has(PROGRAMS.BM100)).toBe(true);
    expect(ids.has(PROGRAMS.LEP)).toBe(true);
    expect(ids.has(PROGRAMS.MBW)).toBe(false);
  });
});

describe('getEnrolledProgramEntries', () => {
  it('returns journey-ordered short labels for all enrollments', () => {
    const courses = [
      { id: 'c1', code: 'MBW' },
      { id: 'c2', code: 'LEP' },
      { id: 'c3', code: '100BM' },
    ];
    const entries = getEnrolledProgramEntries(
      { program: PROGRAMS.BM100, enrolledCourses: ['c1', 'c2', 'c3'] },
      courses
    );
    expect(entries.map((e) => e.shortLabel)).toEqual(['LEP', '100BM', 'MBW']);
  });
});

describe('canAccessProgram / getProgramAccessState', () => {
  it('locks programs beyond the next journey step', () => {
    const profile = { program: PROGRAMS.LEP, enrolledCourses: [] };
    expect(canAccessProgram('MBW', profile, [])).toBe(false);
    expect(getProgramAccessState('MBW', profile, []).state).toBe(PROGRAM_ACCESS.LOCKED);
    expect(getProgramAccessState('100BM', profile, []).state).toBe(PROGRAM_ACCESS.UPCOMING);
  });

  it('opens enrolled programs', () => {
    const courses = [{ id: 'mbw1', code: 'MBW' }];
    const profile = { enrolledCourses: ['mbw1'] };
    expect(canAccessProgram('MBW', profile, courses)).toBe(true);
    expect(getProgramAccessState('MBW', profile, courses).state).toBe(PROGRAM_ACCESS.OPEN);
  });
});


describe('canOpenProgramTasks', () => {
  const enrolledWith = (paymentStatus) => ({
    programs: [PROGRAMS.MBW],
    programAccess: { [PROGRAMS.MBW]: { paymentStatus } },
  });

  it('opens tasks for a fully paid learner', () => {
    expect(canOpenProgramTasks(PROGRAMS.MBW, enrolledWith(PAYMENT_STATUS.PAID))).toBe(true);
  });

  it('opens tasks for a registration-tier learner, who owns phase one', () => {
    expect(canOpenProgramTasks(PROGRAMS.MBW, enrolledWith(PAYMENT_STATUS.REGISTER))).toBe(true);
  });

  it('refuses a learner who is enrolled but unpaid', () => {
    const profile = enrolledWith(PAYMENT_STATUS.UNPAID);
    // The distinction this helper exists for: enrolment alone said yes.
    expect(canAccessProgram(PROGRAMS.MBW, profile)).toBe(true);
    expect(canOpenProgramTasks(PROGRAMS.MBW, profile)).toBe(false);
  });

  it('refuses a learner who is not enrolled at all', () => {
    expect(canOpenProgramTasks(PROGRAMS.MBW, { programs: [] })).toBe(false);
  });

  it('refuses an unknown programme', () => {
    expect(canOpenProgramTasks('not-a-programme', enrolledWith(PAYMENT_STATUS.PAID))).toBe(false);
  });

  it('is surfaced on the access state, so both surfaces read one answer', () => {
    const unpaid = getProgramAccessState(PROGRAMS.MBW, enrolledWith(PAYMENT_STATUS.UNPAID));
    expect(unpaid.canAccess).toBe(true);
    expect(unpaid.canOpenTasks).toBe(false);

    const paid = getProgramAccessState(PROGRAMS.MBW, enrolledWith(PAYMENT_STATUS.PAID));
    expect(paid.canOpenTasks).toBe(true);
  });

  it('reports canOpenTasks false on every non-enrolled branch', () => {
    for (const state of [getProgramAccessState(PROGRAMS.MBW, { programs: [] }),
                         getProgramAccessState(PROGRAMS.LEP, { programs: [] })]) {
      expect(state.canOpenTasks).toBe(false);
    }
  });
});
