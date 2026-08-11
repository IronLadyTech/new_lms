import { describe, it, expect } from 'vitest';
import {
  TASK_STATUS_LABELS,
  classifyLearnerTaskStatus,
  buildTaskStatusChartData,
} from './cxDrilldown';
import { buildSubmissionIndex } from './cxMetrics';
import { SUBMISSION_STATUS } from '../services/mbwService';

/**
 * These buckets drive the CX pie chart and the drill-down behind it. They must
 * be mutually exclusive and must add up to the cohort — a learner counted twice
 * or dropped makes the chart quietly lie about the batch.
 */

const learner = (id) => ({ id, role: 'student' });
const tasks = [{ id: 't1' }, { id: 't2' }];

const sub = (userId, taskId, status) => ({ userId, taskId, status });

describe('classifyLearnerTaskStatus', () => {
  const index = (subs) => buildSubmissionIndex(subs);

  it('is Done only when every task is complete', () => {
    const i = index([
      sub('u1', 't1', SUBMISSION_STATUS.COMPLETED),
      sub('u1', 't2', SUBMISSION_STATUS.COMPLETED),
    ]);
    expect(classifyLearnerTaskStatus(learner('u1'), tasks, i)).toBe(TASK_STATUS_LABELS.DONE);
  });

  it('is Not started when some tasks remain', () => {
    const i = index([sub('u1', 't1', SUBMISSION_STATUS.COMPLETED)]);
    expect(classifyLearnerTaskStatus(learner('u1'), tasks, i)).toBe(TASK_STATUS_LABELS.NOT_STARTED);
  });

  it('is Not started when the learner has done nothing', () => {
    expect(classifyLearnerTaskStatus(learner('u1'), tasks, index([]))).toBe(
      TASK_STATUS_LABELS.NOT_STARTED
    );
  });

  it('prioritises Action required over everything else', () => {
    // A learner who has finished all but one task, and that one needs a
    // resubmit, is a learner CX must chase — not a "nearly done" statistic.
    const i = index([
      sub('u1', 't1', SUBMISSION_STATUS.COMPLETED),
      sub('u1', 't2', SUBMISSION_STATUS.NEEDS_IMPROVEMENT),
    ]);
    expect(classifyLearnerTaskStatus(learner('u1'), tasks, i)).toBe(TASK_STATUS_LABELS.ACTION);
  });

  it('returns null when the programme has no tasks to judge against', () => {
    expect(classifyLearnerTaskStatus(learner('u1'), [], index([]))).toBeNull();
    expect(classifyLearnerTaskStatus(learner('u1'), null, index([]))).toBeNull();
  });

  it('assigns exactly one bucket per learner', () => {
    const i = index([
      sub('u1', 't1', SUBMISSION_STATUS.COMPLETED),
      sub('u1', 't2', SUBMISSION_STATUS.NEEDS_IMPROVEMENT),
    ]);
    const result = classifyLearnerTaskStatus(learner('u1'), tasks, i);
    const all = Object.values(TASK_STATUS_LABELS);
    expect(all.filter((label) => label === result)).toHaveLength(1);
  });
});

describe('buildTaskStatusChartData', () => {
  const students = [learner('u1'), learner('u2'), learner('u3')];

  it('totals exactly the cohort size — nobody double-counted or dropped', () => {
    const data = buildTaskStatusChartData(students, tasks, [
      sub('u1', 't1', SUBMISSION_STATUS.COMPLETED),
      sub('u1', 't2', SUBMISSION_STATUS.COMPLETED),
      sub('u2', 't1', SUBMISSION_STATUS.NEEDS_IMPROVEMENT),
    ]);
    const total = data.reduce((n, slice) => n + slice.value, 0);
    expect(total).toBe(students.length);
  });

  it('separates the three buckets correctly', () => {
    const data = buildTaskStatusChartData(students, tasks, [
      sub('u1', 't1', SUBMISSION_STATUS.COMPLETED),
      sub('u1', 't2', SUBMISSION_STATUS.COMPLETED),
      sub('u2', 't1', SUBMISSION_STATUS.NEEDS_IMPROVEMENT),
    ]);
    const byName = Object.fromEntries(data.map((d) => [d.name, d.value]));
    expect(byName[TASK_STATUS_LABELS.DONE]).toBe(1); // u1
    expect(byName[TASK_STATUS_LABELS.ACTION]).toBe(1); // u2
    expect(byName[TASK_STATUS_LABELS.NOT_STARTED]).toBe(1); // u3
  });

  it('handles an empty cohort without dividing by zero', () => {
    const data = buildTaskStatusChartData([], tasks, []);
    expect(data.reduce((n, s) => n + s.value, 0)).toBe(0);
  });

  it('handles a programme with no tasks', () => {
    expect(() => buildTaskStatusChartData(students, [], [])).not.toThrow();
  });
});
