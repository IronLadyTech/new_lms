import { describe, it, expect } from 'vitest';
import {
  normalizeCourseCode,
  getProgramTasksPath,
  getProgramLessonPath,
  isProgramWithTasks,
} from './programTaskRoutes';

/**
 * Codes arrive from Firestore and from Zoho in inconsistent shapes. A missed
 * normalisation sends a learner to a dead route instead of their programme.
 */

describe('normalizeCourseCode', () => {
  it('canonicalises the known codes regardless of case or spacing', () => {
    expect(normalizeCourseCode('mbw')).toBe('MBW');
    expect(normalizeCourseCode('  MBW  ')).toBe('MBW');
    expect(normalizeCourseCode('lep')).toBe('LEP');
    expect(normalizeCourseCode('100 bm')).toBe('100BM');
    expect(normalizeCourseCode('100 Board Members')).toBe('100BM');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeCourseCode('')).toBe('');
    expect(normalizeCourseCode(null)).toBe('');
    expect(normalizeCourseCode(undefined)).toBe('');
  });

  it('upper-cases an unrecognised code rather than dropping it', () => {
    expect(normalizeCourseCode('xyz')).toBe('XYZ');
  });
});

describe('getProgramTasksPath', () => {
  it('routes the two task-bearing programmes', () => {
    expect(getProgramTasksPath('MBW')).toBe('/app/mbw');
    expect(getProgramTasksPath('100BM')).toBe('/app/100bm');
  });

  it('routes messy Zoho spellings correctly', () => {
    expect(getProgramTasksPath('100 Board Members')).toBe('/app/100bm');
    expect(getProgramTasksPath(' mbw ')).toBe('/app/mbw');
  });

  it('returns null for programmes with no task workspace', () => {
    // LEP has no task journey — callers must hide the link rather than
    // navigate to "/null".
    expect(getProgramTasksPath('LEP')).toBeNull();
    expect(getProgramTasksPath('XYZ')).toBeNull();
    expect(getProgramTasksPath('')).toBeNull();
  });
});

describe('getProgramLessonPath', () => {
  it('appends the lesson id', () => {
    expect(getProgramLessonPath('MBW', 'mbw-orientation')).toBe('/app/mbw?lesson=mbw-orientation');
    expect(getProgramLessonPath('100BM', 't1')).toBe('/app/100bm?lesson=t1');
  });

  it('falls back to the programme page when there is no lesson id', () => {
    expect(getProgramLessonPath('MBW', null)).toBe('/app/mbw');
    expect(getProgramLessonPath('MBW', '')).toBe('/app/mbw');
  });

  it('stays null when the programme has no workspace', () => {
    expect(getProgramLessonPath('LEP', 't1')).toBeNull();
  });
});

describe('isProgramWithTasks', () => {
  it('is true only for MBW and 100BM', () => {
    expect(isProgramWithTasks('MBW')).toBe(true);
    expect(isProgramWithTasks('100 Board Members')).toBe(true);
    expect(isProgramWithTasks('LEP')).toBe(false);
    expect(isProgramWithTasks('')).toBe(false);
  });
});
