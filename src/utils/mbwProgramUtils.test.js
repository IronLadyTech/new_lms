import { describe, expect, it } from 'vitest';
import { getProgramProgressPct, countPendingTasks } from './mbwProgramUtils.js';
import { SUBMISSION_STATUS } from '../services/mbwService.js';

describe('getProgramProgressPct', () => {
  it('returns 0 when total is zero', () => {
    expect(getProgramProgressPct(0, 0)).toBe(0);
  });

  it('rounds percentage of completed milestones', () => {
    expect(getProgramProgressPct(1, 4)).toBe(25);
    expect(getProgramProgressPct(3, 4)).toBe(75);
    expect(getProgramProgressPct(4, 4)).toBe(100);
  });
});

describe('countPendingTasks', () => {
  const ts = (status) => ({ status });

  it('counts work the learner has not handed in yet', () => {
    expect(
      countPendingTasks([ts(SUBMISSION_STATUS.UNLOCKED), ts(SUBMISSION_STATUS.UNLOCKED)])
    ).toBe(2);
  });

  it('counts work sent back for rework — the learner still has to act', () => {
    expect(
      countPendingTasks([ts(SUBMISSION_STATUS.NEEDS_IMPROVEMENT), ts(SUBMISSION_STATUS.REJECTED)])
    ).toBe(2);
  });

  it('does not count work already handed in or finished', () => {
    expect(
      countPendingTasks([
        ts(SUBMISSION_STATUS.SUBMITTED),
        ts(SUBMISSION_STATUS.UNDER_REVIEW),
        ts(SUBMISSION_STATUS.COMPLETED),
      ])
    ).toBe(0);
  });

  it('does not count locked work the learner cannot reach', () => {
    expect(countPendingTasks([ts(SUBMISSION_STATUS.LOCKED)])).toBe(0);
  });

  it('is zero for an empty or missing programme', () => {
    expect(countPendingTasks([])).toBe(0);
    expect(countPendingTasks()).toBe(0);
  });

  it('counts a realistic mixed programme correctly', () => {
    // Regression guard: this tile read an empty `assignments` collection and
    // always showed 0, telling learners nothing was waiting on them.
    const states = [
      ts(SUBMISSION_STATUS.COMPLETED),
      ts(SUBMISSION_STATUS.SUBMITTED),
      ts(SUBMISSION_STATUS.NEEDS_IMPROVEMENT),
      ts(SUBMISSION_STATUS.UNLOCKED),
      ts(SUBMISSION_STATUS.LOCKED),
    ];
    expect(countPendingTasks(states)).toBe(2);
  });
});
