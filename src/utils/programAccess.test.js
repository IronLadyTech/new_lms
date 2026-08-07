import { describe, expect, it } from 'vitest';
import {
  PROGRAM_ACCESS,
  canAccessProgram,
  courseCodeToProgramId,
  getEnrolledProgramIds,
  getProgramAccessState,
} from './programAccess.js';
import { PROGRAMS } from '../data/programTypes.js';

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
