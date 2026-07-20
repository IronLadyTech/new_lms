import { normalizePaymentStatus, PAYMENT_STATUS } from '../data/accessTiers';
import { studentsInBatch, memberIdsForBatches } from './batchScope';
import { buildSubmissionIndex, isCxSubmissionComplete } from './cxMetrics';
import {
  classifyLearnerJourney,
  ACTIVE_CHART_LABELS,
  PAYMENT_CHART_LABELS,
  formatMonthLabel,
} from './cxCrmDashboard';
import { isLearnerActionRequired } from './submissionReview';

export const TASK_STATUS_LABELS = {
  DONE: 'Done',
  ACTION: 'Action required',
  NOT_STARTED: 'Not started',
};

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

function paymentDataKey(student) {
  const ps = normalizePaymentStatus(student?.paymentStatus);
  if (ps === PAYMENT_STATUS.PAID) return 'paid';
  if (ps === PAYMENT_STATUS.REGISTER) return 'register';
  return 'unpaid';
}

function toParticipant(user) {
  return {
    id: user.id,
    displayName: user.displayName || user.email || 'Unknown',
    email: user.email || '',
    phone: user.phone || '',
  };
}

function formatTitle(segments, count) {
  return `${segments.filter(Boolean).join(' · ')} (${count})`;
}

/** Exclusive learner bucket — matches task-status pie slices and drill-down. */
export function classifyLearnerTaskStatus(student, tasks, submissionIndex) {
  if (!tasks?.length) return null;

  let anyAction = false;
  let allComplete = true;

  for (const task of tasks) {
    const sub = submissionIndex[student.id]?.[task.id];
    if (isLearnerActionRequired(sub?.status)) anyAction = true;
    if (!isCxSubmissionComplete(sub)) allComplete = false;
  }

  if (anyAction) return TASK_STATUS_LABELS.ACTION;
  if (allComplete) return TASK_STATUS_LABELS.DONE;
  return TASK_STATUS_LABELS.NOT_STARTED;
}

/** Pie + legend data for task completion by learner (not per-cell). */
export function buildTaskStatusChartData(students, tasks, submissions) {
  const index = buildSubmissionIndex(submissions);
  const counts = {
    [TASK_STATUS_LABELS.DONE]: 0,
    [TASK_STATUS_LABELS.ACTION]: 0,
    [TASK_STATUS_LABELS.NOT_STARTED]: 0,
  };

  students.forEach((student) => {
    const bucket = classifyLearnerTaskStatus(student, tasks, index);
    if (bucket) counts[bucket] += 1;
  });

  return [
    { name: TASK_STATUS_LABELS.DONE, value: counts[TASK_STATUS_LABELS.DONE] },
    { name: TASK_STATUS_LABELS.ACTION, value: counts[TASK_STATUS_LABELS.ACTION] },
    { name: TASK_STATUS_LABELS.NOT_STARTED, value: counts[TASK_STATUS_LABELS.NOT_STARTED] },
  ];
}

function activityBucket(student) {
  const now = Date.now();
  const cutoff7 = now - 7 * 86400000;
  const cutoff30 = now - 30 * 86400000;
  const ms = activityMs(student);

  if (ms >= cutoff7) return ACTIVE_CHART_LABELS.active7;
  if (ms >= cutoff30) return ACTIVE_CHART_LABELS.active30;
  return ACTIVE_CHART_LABELS.inactive;
}

function drillBatchStatus(ctx, category, seriesKey) {
  const batch = ctx.batches.find((b) => b.id === category || b.name === category);
  if (!batch) return null;

  const index = buildSubmissionIndex(ctx.submissions);
  const learners = studentsInBatch(batch, ctx.users);
  const filtered = learners.filter(
    (s) => classifyLearnerJourney(s, ctx.tasks, index) === seriesKey
  );

  return {
    title: formatTitle([batch.name, seriesKey], filtered.length),
    participants: filtered.map(toParticipant),
  };
}

function drillPayment(ctx, category, seriesKey) {
  const filtered = ctx.students.filter((student) => {
    const month = monthKeyFromMs(createdMs(student)) || 'unknown';
    return month === category && paymentDataKey(student) === seriesKey;
  });

  const monthLabel = formatMonthLabel(category);
  const paymentLabel = PAYMENT_CHART_LABELS[seriesKey] || seriesKey;

  return {
    title: formatTitle([monthLabel, paymentLabel], filtered.length),
    participants: filtered.map(toParticipant),
  };
}

function drillActivity(ctx, seriesKey) {
  const filtered = ctx.students.filter((s) => activityBucket(s) === seriesKey);

  return {
    title: formatTitle(['Participant activity', seriesKey], filtered.length),
    participants: filtered.map(toParticipant),
  };
}

function drillAssignment(ctx, seriesKey) {
  const assignedIds = new Set(memberIdsForBatches(ctx.batches, ctx.users));
  const filtered = ctx.students.filter((s) => {
    const isAssigned = assignedIds.has(s.id);
    return seriesKey === 'assigned' ? isAssigned : !isAssigned;
  });

  const label = seriesKey === 'assigned' ? 'In a batch' : 'Not assigned';

  return {
    title: formatTitle(['Batch assignment', label], filtered.length),
    participants: filtered.map(toParticipant),
  };
}

function drillBatchCompletion(ctx, category) {
  const batch = ctx.batches.find((b) => b.id === category || b.name === category);
  if (!batch) return null;

  const learners = studentsInBatch(batch, ctx.users);

  return {
    title: formatTitle([batch.name], learners.length),
    participants: learners.map(toParticipant),
  };
}

function drillTaskStatus(ctx, seriesKey) {
  const index = buildSubmissionIndex(ctx.submissions);
  const filtered = ctx.students.filter(
    (s) => classifyLearnerTaskStatus(s, ctx.tasks, index) === seriesKey
  );

  return {
    title: formatTitle(['Task completion', seriesKey], filtered.length),
    participants: filtered.map(toParticipant),
  };
}

/**
 * Resolve a chart segment click into modal payload.
 * @param {{ chartId: string, seriesKey: string, category?: string }} descriptor
 * @param {{ batches, users, students, tasks, submissions }} ctx
 */
export function resolveCxDrilldown(descriptor, ctx) {
  if (!descriptor?.chartId || descriptor.seriesKey == null) return null;

  const { chartId, seriesKey, category } = descriptor;

  switch (chartId) {
    case 'batchStatus':
      if (!category) return null;
      return drillBatchStatus(ctx, category, seriesKey);
    case 'payment':
      if (!category) return null;
      return drillPayment(ctx, category, seriesKey);
    case 'activity':
      return drillActivity(ctx, seriesKey);
    case 'assignment':
      return drillAssignment(ctx, seriesKey);
    case 'batchCompletion':
      if (!category) return null;
      return drillBatchCompletion(ctx, category);
    case 'taskStatus':
      return drillTaskStatus(ctx, seriesKey);
    default:
      return null;
  }
}
