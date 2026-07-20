import {
  normalizePaymentStatus,
  PAYMENT_STATUS,
  resolveAccessTier,
  ACCESS_TIERS,
} from '../data/accessTiers';
import { studentsInBatch } from './batchScope';
import { buildSubmissionIndex, isCxSubmissionComplete } from './cxMetrics';

/** Plain-language labels aligned with Zoho CRM cohort views. */
export const JOURNEY_LABELS = {
  NONE: 'None',
  REGISTERED: 'Registered',
  AWAITING: 'Paid — awaiting start',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
};

export const PAYMENT_CHART_LABELS = {
  unpaid: 'Unpaid',
  register: 'Registration paid',
  paid: 'Full payment',
};

export const ACTIVE_CHART_LABELS = {
  active7: 'Active (7 days)',
  active30: 'Active (30 days)',
  inactive: 'Inactive',
};

const JOURNEY_ORDER = [
  JOURNEY_LABELS.NONE,
  JOURNEY_LABELS.REGISTERED,
  JOURNEY_LABELS.AWAITING,
  JOURNEY_LABELS.ONGOING,
  JOURNEY_LABELS.COMPLETED,
];

function activityMs(user) {
  const ts = user?.lastActivityAt;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function createdMs(user) {
  const ts = user?.createdAt;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function monthKeyFromMs(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key) {
  if (!key) return 'Unknown';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function learnerTaskPct(student, tasks, submissionIndex) {
  if (!tasks.length) return 0;
  let done = 0;
  tasks.forEach((task) => {
    if (isCxSubmissionComplete(submissionIndex[student.id]?.[task.id])) done += 1;
  });
  return Math.round((done / tasks.length) * 100);
}

/** Classify one learner — mirrors Zoho batch status buckets. */
export function classifyLearnerJourney(student, tasks, submissionIndex) {
  const ps = normalizePaymentStatus(student?.paymentStatus);
  const tier = resolveAccessTier(student);
  const pct = learnerTaskPct(student, tasks, submissionIndex);
  const lastActive = activityMs(student);
  const active30 = lastActive >= Date.now() - 30 * 86400000;

  if (pct >= 95 && tasks.length > 0) return JOURNEY_LABELS.COMPLETED;

  if (ps === PAYMENT_STATUS.UNPAID && tier !== ACCESS_TIERS.REGISTRATION && tier !== ACCESS_TIERS.FULL) {
    return JOURNEY_LABELS.NONE;
  }

  if (ps === PAYMENT_STATUS.REGISTER || tier === ACCESS_TIERS.REGISTRATION) {
    return active30 || pct > 0 ? JOURNEY_LABELS.ONGOING : JOURNEY_LABELS.REGISTERED;
  }

  if (ps === PAYMENT_STATUS.PAID || tier === ACCESS_TIERS.FULL) {
    if (!active30 && pct < 10) return JOURNEY_LABELS.AWAITING;
    return JOURNEY_LABELS.ONGOING;
  }

  if (active30 || pct > 0) return JOURNEY_LABELS.ONGOING;
  return JOURNEY_LABELS.NONE;
}

function emptyJourneyCounts() {
  return Object.fromEntries(JOURNEY_ORDER.map((k) => [k, 0]));
}

/** Stacked bar: journey status per batch. */
export function buildBatchStatusChart(batches, users, tasks, submissions) {
  const index = buildSubmissionIndex(submissions);
  return batches.map((batch) => {
    const learners = studentsInBatch(batch, users);
    const counts = emptyJourneyCounts();
    learners.forEach((s) => {
      const status = classifyLearnerJourney(s, tasks, index);
      counts[status] = (counts[status] || 0) + 1;
    });
    return {
      batchId: batch.id,
      name: batch.name,
      total: learners.length,
      ...counts,
    };
  });
}

/** Assigned vs unassigned learners (programs without task tracking). */
export function buildEnrollmentAssignmentChart(students, assignedCount) {
  const assigned = assignedCount ?? 0;
  const total = students.length;
  const unassigned = Math.max(0, total - assigned);
  return {
    name: 'Participants',
    assigned,
    unassigned,
    total,
  };
}

/** Stacked bar: payment status by registration month. */
export function buildPaymentStatusChart(students) {
  const byMonth = {};

  students.forEach((student) => {
    const key = monthKeyFromMs(createdMs(student)) || 'unknown';
    if (!byMonth[key]) {
      byMonth[key] = { month: key, label: formatMonthLabel(key), unpaid: 0, register: 0, paid: 0 };
    }
    const ps = normalizePaymentStatus(student.paymentStatus);
    if (ps === PAYMENT_STATUS.PAID) byMonth[key].paid += 1;
    else if (ps === PAYMENT_STATUS.REGISTER) byMonth[key].register += 1;
    else byMonth[key].unpaid += 1;
  });

  return Object.values(byMonth)
    .filter((row) => row.month !== 'unknown' || row.unpaid + row.register + row.paid > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8);
}

/** Stacked bar: activity buckets (7d / 30d / inactive). */
export function buildActiveStatusChart(students) {
  const now = Date.now();
  const cutoff7 = now - 7 * 86400000;
  const cutoff30 = now - 30 * 86400000;

  let active7 = 0;
  let active30Only = 0;
  let inactive = 0;

  students.forEach((s) => {
    const ms = activityMs(s);
    if (ms >= cutoff7) active7 += 1;
    else if (ms >= cutoff30) active30Only += 1;
    else inactive += 1;
  });

  return [
    {
      name: 'Participants',
      [ACTIVE_CHART_LABELS.active7]: active7,
      [ACTIVE_CHART_LABELS.active30]: active30Only,
      [ACTIVE_CHART_LABELS.inactive]: inactive,
      total: students.length,
    },
  ];
}

/** Program-wide journey totals for summary. */
export function buildProgramJourneySummary(students, tasks, submissions) {
  const index = buildSubmissionIndex(submissions);
  const counts = emptyJourneyCounts();
  students.forEach((s) => {
    const status = classifyLearnerJourney(s, tasks, index);
    counts[status] = (counts[status] || 0) + 1;
  });
  return { counts, total: students.length, order: JOURNEY_ORDER };
}

export { JOURNEY_ORDER, formatMonthLabel };
