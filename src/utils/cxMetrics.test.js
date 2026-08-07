import { describe, expect, it } from 'vitest';
import {
  countCompletedCells,
  filterCxTasks,
  isCxSubmissionComplete,
  moduleCompletionPct,
} from './cxMetrics.js';
import { PROGRAMS } from '../data/programTypes.js';
import { SUBMISSION_STATUS } from '../services/mbwService.js';

describe('isCxSubmissionComplete', () => {
  it('treats submitted and completed as done', () => {
    expect(isCxSubmissionComplete({ status: SUBMISSION_STATUS.SUBMITTED })).toBe(true);
    expect(isCxSubmissionComplete({ status: SUBMISSION_STATUS.COMPLETED })).toBe(true);
    expect(isCxSubmissionComplete({ status: SUBMISSION_STATUS.UNLOCKED })).toBe(false);
    expect(isCxSubmissionComplete(null)).toBe(false);
  });
});

describe('filterCxTasks', () => {
  it('scopes MBW tasks to active phases when present', () => {
    const tasks = [
      { id: 'a', phase: 'pre-preparation' },
      { id: 'b', phase: 'quarter-1' },
      { id: 'c', phase: 'quarter-4' },
    ];
    const filtered = filterCxTasks(tasks, PROGRAMS.MBW);
    expect(filtered.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('countCompletedCells / moduleCompletionPct', () => {
  it('computes completion percentage across students and tasks', () => {
    const students = [{ id: 'u1' }, { id: 'u2' }];
    const tasks = [{ id: 't1' }, { id: 't2' }];
    const submissions = [
      { userId: 'u1', taskId: 't1', status: SUBMISSION_STATUS.COMPLETED },
      { userId: 'u1', taskId: 't2', status: SUBMISSION_STATUS.SUBMITTED },
    ];
    expect(countCompletedCells(students, tasks, submissions)).toBe(2);
    expect(moduleCompletionPct(students, tasks, submissions)).toBe(50);
  });
});
