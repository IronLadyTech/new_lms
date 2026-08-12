import { describe, it, expect } from 'vitest';
import {
  buildEnrollmentAssignmentChart,
  buildPaymentStatusChart,
  buildActiveStatusChart,
  classifyLearnerJourney,
  buildBatchStatusChart,
  ACTIVE_CHART_LABELS,
  JOURNEY_LABELS,
} from './cxCrmDashboard';
import { PAYMENT_STATUS } from '../data/accessTiers';
import { buildProgressSummary } from './progressSummary';
import { buildSubmissionIndex } from './cxMetrics';

/**
 * Every chart here is a stacked total. The invariant that matters is that the
 * stack sums to the cohort — a bucket that silently swallows learners makes the
 * dashboard understate the batch, which is how the review backlog went unseen.
 */

const monthsAgo = (n) => ({ toMillis: () => Date.now() - n * 30 * 86400000 });
const daysAgo = (n) => ({ toMillis: () => Date.now() - n * 86400000 });

describe('buildEnrollmentAssignmentChart', () => {
  it('splits assigned from unassigned', () => {
    const chart = buildEnrollmentAssignmentChart([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2);
    expect(chart.assigned).toBe(2);
    expect(chart.unassigned).toBe(1);
    expect(chart.total).toBe(3);
  });

  it('always sums to the cohort', () => {
    const chart = buildEnrollmentAssignmentChart([{ id: 'a' }, { id: 'b' }], 1);
    expect(chart.assigned + chart.unassigned).toBe(chart.total);
  });

  it('never shows a negative bar if the assigned count overshoots', () => {
    const chart = buildEnrollmentAssignmentChart([{ id: 'a' }], 5);
    expect(chart.unassigned).toBe(0);
  });

  it('handles an empty cohort and a missing count', () => {
    expect(buildEnrollmentAssignmentChart([], 0).total).toBe(0);
    expect(buildEnrollmentAssignmentChart([{ id: 'a' }], undefined).assigned).toBe(0);
  });
});

describe('buildPaymentStatusChart', () => {
  it('buckets learners by payment tier within their signup month', () => {
    const rows = buildPaymentStatusChart([
      { id: 'a', createdAt: monthsAgo(1), paymentStatus: PAYMENT_STATUS.PAID },
      { id: 'b', createdAt: monthsAgo(1), paymentStatus: PAYMENT_STATUS.REGISTER },
      { id: 'c', createdAt: monthsAgo(1), paymentStatus: 'unpaid' },
    ]);
    const total = rows.reduce((n, r) => n + r.paid + r.register + r.unpaid, 0);
    expect(total).toBe(3);
  });

  it('treats an unrecognised payment status as unpaid rather than dropping it', () => {
    const rows = buildPaymentStatusChart([
      { id: 'a', createdAt: monthsAgo(1), paymentStatus: 'mystery-value' },
    ]);
    expect(rows.reduce((n, r) => n + r.unpaid, 0)).toBe(1);
  });

  it('sorts months chronologically', () => {
    const rows = buildPaymentStatusChart([
      { id: 'a', createdAt: monthsAgo(1) },
      { id: 'b', createdAt: monthsAgo(5) },
      { id: 'c', createdAt: monthsAgo(3) },
    ]);
    expect(rows.map((r) => r.month)).toEqual([...rows.map((r) => r.month)].sort());
  });

  it('caps at the last 8 months so the axis stays readable', () => {
    const students = Array.from({ length: 14 }, (_, i) => ({
      id: `u${i}`,
      createdAt: monthsAgo(i + 1),
    }));
    expect(buildPaymentStatusChart(students).length).toBeLessThanOrEqual(8);
  });

  it('returns an empty series for no learners', () => {
    expect(buildPaymentStatusChart([])).toEqual([]);
  });
});

describe('buildActiveStatusChart', () => {
  const read = (row) => ({
    a7: row[ACTIVE_CHART_LABELS.active7],
    a30: row[ACTIVE_CHART_LABELS.active30],
    inactive: row[ACTIVE_CHART_LABELS.inactive],
  });

  it('splits the cohort into exclusive activity buckets', () => {
    const [row] = buildActiveStatusChart([
      { id: 'a', lastActivityAt: daysAgo(1) },
      { id: 'b', lastActivityAt: daysAgo(20) },
      { id: 'c', lastActivityAt: daysAgo(90) },
      { id: 'd' },
    ]);
    const { a7, a30, inactive } = read(row);
    expect(a7).toBe(1);
    expect(a30).toBe(1);
    expect(inactive).toBe(2);
  });

  it('always sums to the cohort', () => {
    const students = Array.from({ length: 9 }, (_, i) => ({
      id: `u${i}`,
      lastActivityAt: daysAgo(i * 6),
    }));
    const [row] = buildActiveStatusChart(students);
    const { a7, a30, inactive } = read(row);
    expect(a7 + a30 + inactive).toBe(students.length);
    expect(row.total).toBe(students.length);
  });

  it('counts a learner who has never been active as inactive, not missing', () => {
    const [row] = buildActiveStatusChart([{ id: 'a' }]);
    expect(read(row).inactive).toBe(1);
    expect(row.total).toBe(1);
  });

  it('returns a zeroed row for an empty cohort', () => {
    const [row] = buildActiveStatusChart([]);
    expect(row.total).toBe(0);
  });
});

/**
 * The batch-status chart had no tests, which is how a missing import in the
 * module it lives in passed the whole suite. The chart is read as a statement
 * about where every batch stands, so the arithmetic behind it is pinned here.
 */
const tasks = [
  { id: 't1', phase: 'quarter-1' },
  { id: 't2', phase: 'quarter-1' },
  { id: 't3', phase: 'quarter-1' },
  { id: 't4', phase: 'quarter-1' },
];

const learner = (over = {}) => ({
  id: 'u1',
  paymentStatus: 'paid',
  lastActivityAt: { seconds: Math.floor(Date.now() / 1000) },
  ...over,
});

const subs = (statuses) =>
  statuses.map((status, i) => ({ userId: 'u1', taskId: `t${i + 1}`, status }));

/** Same learner, same work — one route reads the record, the other the history. */
function bothRoutes(statuses, over = {}) {
  const submissions = subs(statuses);
  const index = buildSubmissionIndex(submissions);

  const viaHistory = classifyLearnerJourney(learner(over), tasks, index);
  const viaSummary = classifyLearnerJourney(
    learner({ ...over, mbwProgress: buildProgressSummary(tasks, submissions) }),
    tasks,
    {} // deliberately empty: if the summary is not used this cannot be right
  );
  return { viaHistory, viaSummary };
}

describe('classifyLearnerJourney', () => {
  it('reads the learner record and the history to the same answer, part way through', () => {
    const { viaHistory, viaSummary } = bothRoutes(['completed', 'submitted']);
    expect(viaSummary).toBe(viaHistory);
    expect(viaSummary).toBe(JOURNEY_LABELS.ONGOING);
  });

  it('agrees once every task is done', () => {
    const { viaHistory, viaSummary } = bothRoutes([
      'completed',
      'completed',
      'completed',
      'completed',
    ]);
    expect(viaSummary).toBe(viaHistory);
    expect(viaSummary).toBe(JOURNEY_LABELS.COMPLETED);
  });

  it('agrees for a paid learner who has not started and is inactive', () => {
    const old = { seconds: Math.floor((Date.now() - 60 * 86400000) / 1000) };
    const { viaHistory, viaSummary } = bothRoutes([], { lastActivityAt: old });
    expect(viaSummary).toBe(viaHistory);
    expect(viaSummary).toBe(JOURNEY_LABELS.AWAITING);
  });

  it('agrees for an unpaid learner', () => {
    const { viaHistory, viaSummary } = bothRoutes([], { paymentStatus: 'unpaid' });
    expect(viaSummary).toBe(viaHistory);
    expect(viaSummary).toBe(JOURNEY_LABELS.NONE);
  });

  it('does not count work from a phase the chart is not showing', () => {
    const otherPhase = [{ id: 'x1', phase: 'quarter-4' }];
    const submissions = [{ userId: 'u1', taskId: 'x1', status: 'completed' }];
    const summary = buildProgressSummary([...tasks, ...otherPhase], submissions);
    // Complete in quarter-4, nothing in quarter-1: must not read as finished.
    expect(classifyLearnerJourney(learner({ mbwProgress: summary }), tasks, {})).not.toBe(
      JOURNEY_LABELS.COMPLETED
    );
  });
});

describe('buildBatchStatusChart', () => {
  it('counts each batch’s learners into journey buckets', () => {
    const users = [
      {
        id: 'a',
        paymentStatus: 'paid',
        mbwProgress: buildProgressSummary(
          tasks,
          subs(['completed', 'completed', 'completed', 'completed'])
        ),
      },
      { id: 'b', paymentStatus: 'unpaid' },
    ];
    const batches = [{ id: 'b1', name: 'Batch 1', memberIds: ['a', 'b'] }];

    const [row] = buildBatchStatusChart(batches, users, tasks, []);
    expect(row.name).toBe('Batch 1');
    expect(row.total).toBe(2);
    expect(row[JOURNEY_LABELS.COMPLETED]).toBe(1);
    expect(row[JOURNEY_LABELS.NONE]).toBe(1);
  });
});
