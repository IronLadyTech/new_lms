import { describe, it, expect } from 'vitest';
import {
  buildEnrollmentAssignmentChart,
  buildPaymentStatusChart,
  buildActiveStatusChart,
  ACTIVE_CHART_LABELS,
} from './cxCrmDashboard';
import { PAYMENT_STATUS } from '../data/accessTiers';

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
