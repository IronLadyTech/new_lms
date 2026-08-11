import { describe, it, expect } from 'vitest';
import {
  countActiveParticipants,
  countInactiveParticipants,
  countPendingReviews,
  countAwaitingResubmit,
  buildRecentActivity,
  formatActivityAge,
  aggregateAttendanceStats,
} from './cxAnalytics';
import { SUBMISSION_STATUS } from '../services/mbwService';

/**
 * These are the numbers CX staff plan their week against. The rule this suite
 * enforces is that a count is never quietly capped or rounded into being wrong
 * — the review-queue tile once reported 8 against a real backlog of 47.
 */

const daysAgo = (n) => ({ toMillis: () => Date.now() - n * 86400000 });

describe('countActiveParticipants', () => {
  const students = [
    { id: 'a', lastActivityAt: daysAgo(1) },
    { id: 'b', lastActivityAt: daysAgo(6) },
    { id: 'c', lastActivityAt: daysAgo(20) },
    { id: 'd' },
  ];

  it('counts only learners inside the window', () => {
    expect(countActiveParticipants(students, 7)).toBe(2);
    expect(countActiveParticipants(students, 30)).toBe(3);
  });

  it('accepts both Firestore timestamp shapes', () => {
    const secs = [{ id: 'x', lastActivityAt: { seconds: Math.floor(Date.now() / 1000) } }];
    expect(countActiveParticipants(secs, 7)).toBe(1);
  });

  it('never counts a learner with no recorded activity', () => {
    expect(countActiveParticipants([{ id: 'd' }], 3650)).toBe(0);
  });

  it('is zero for an empty cohort', () => {
    expect(countActiveParticipants([], 7)).toBe(0);
  });
});

describe('countInactiveParticipants', () => {
  it('counts learners who have never done anything', () => {
    expect(countInactiveParticipants([{ id: 'a', lastActivityAt: daysAgo(1) }, { id: 'b' }])).toBe(
      1
    );
  });
});

describe('countPendingReviews / countAwaitingResubmit', () => {
  const submissions = [
    { status: SUBMISSION_STATUS.SUBMITTED },
    { status: SUBMISSION_STATUS.UNDER_REVIEW },
    { status: SUBMISSION_STATUS.NEEDS_IMPROVEMENT },
    { status: SUBMISSION_STATUS.COMPLETED },
    { status: SUBMISSION_STATUS.LOCKED },
  ];

  it('counts work waiting on staff', () => {
    expect(countPendingReviews(submissions)).toBe(2);
  });

  it('counts work waiting on the learner', () => {
    expect(countAwaitingResubmit(submissions)).toBe(1);
  });

  it('never counts completed or locked work as outstanding', () => {
    const done = [{ status: SUBMISSION_STATUS.COMPLETED }, { status: SUBMISSION_STATUS.LOCKED }];
    expect(countPendingReviews(done)).toBe(0);
    expect(countAwaitingResubmit(done)).toBe(0);
  });

  it('reports the true total for a large backlog, uncapped', () => {
    const many = Array.from({ length: 47 }, () => ({ status: SUBMISSION_STATUS.SUBMITTED }));
    expect(countPendingReviews(many)).toBe(47);
  });
});

describe('buildRecentActivity', () => {
  const students = [
    { id: 'a', displayName: 'Priya' },
    { id: 'b', displayName: 'Anita' },
  ];

  it('orders newest first', () => {
    const items = buildRecentActivity(students, [
      { id: 's1', userId: 'a', taskId: 't1', submittedAt: daysAgo(5), taskTitle: 'Old' },
      { id: 's2', userId: 'b', taskId: 't2', submittedAt: daysAgo(1), taskTitle: 'New' },
    ]);
    expect(items[0].label).toBe('New');
  });

  it('respects the limit', () => {
    const subs = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      userId: 'a',
      taskId: `t${i}`,
      submittedAt: daysAgo(i + 1),
      taskTitle: `Task ${i}`,
    }));
    expect(buildRecentActivity(students, subs, 5)).toHaveLength(5);
  });

  it('drops submissions from learners outside the cohort', () => {
    const items = buildRecentActivity(students, [
      { id: 's1', userId: 'ghost', taskId: 't1', submittedAt: daysAgo(1) },
    ]);
    expect(items).toEqual([]);
  });

  it('skips submissions with no usable timestamp', () => {
    expect(buildRecentActivity(students, [{ id: 's1', userId: 'a', taskId: 't1' }])).toEqual([]);
  });

  it('names the task rather than showing a bare id', () => {
    const [item] = buildRecentActivity(students, [
      { id: 's1', userId: 'a', taskId: 't1', submittedAt: daysAgo(1) },
    ]);
    expect(item.label).toBe('Task submission');
  });
});

describe('formatActivityAge', () => {
  it('describes recent activity in days', () => {
    expect(formatActivityAge(Date.now())).toBe('Today');
    expect(formatActivityAge(Date.now() - 86400000)).toBe('1d ago');
    expect(formatActivityAge(Date.now() - 5 * 86400000)).toBe('5d ago');
  });

  it('switches to months past 30 days', () => {
    expect(formatActivityAge(Date.now() - 45 * 86400000)).toBe('1mo ago');
    expect(formatActivityAge(Date.now() - 120 * 86400000)).toBe('4mo ago');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(formatActivityAge(0)).toBe('');
    expect(formatActivityAge(null)).toBe('');
  });
});

describe('aggregateAttendanceStats', () => {
  it('averages percentages and flags learners under 60%', () => {
    const stats = aggregateAttendanceStats({
      b1: { u1: { present: 10, total: 10 }, u2: { present: 5, total: 10 } },
      b2: { u3: { present: 3, total: 10 } },
    });
    expect(stats.tracked).toBe(3);
    expect(stats.avgPct).toBe(60); // (100 + 50 + 30) / 3
    expect(stats.atRisk).toBe(2); // 50% and 30%
  });

  it('ignores learners with no sessions recorded, avoiding divide-by-zero', () => {
    const stats = aggregateAttendanceStats({ b1: { u1: { present: 0, total: 0 } } });
    expect(stats).toBeNull();
  });

  it('returns null rather than a misleading zero when nothing is tracked', () => {
    expect(aggregateAttendanceStats({})).toBeNull();
    expect(aggregateAttendanceStats(null)).toBeNull();
  });

  it('counts a learner at exactly 60% as not at risk', () => {
    const stats = aggregateAttendanceStats({ b1: { u1: { present: 6, total: 10 } } });
    expect(stats.atRisk).toBe(0);
  });
});
