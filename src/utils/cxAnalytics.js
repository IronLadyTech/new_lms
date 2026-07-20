import { SUBMISSION_STATUS } from '../services/mbwService';
import { isLearnerActionRequired } from './submissionReview';
import {
  getBatchRecordingSessions,
  hasProgramRecordingSessions,
} from './batchRecordingSessions';
import { getBatchRecordingPhases } from '../data/batchRecordingPhases';

function activityMs(user) {
  const ts = user?.lastActivityAt;
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function submissionMs(sub) {
  const ts = sub?.submittedAt || sub?.updatedAt;
  if (!ts) return 0;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/** Participants active within N days (based on lastActivityAt). */
export function countActiveParticipants(students, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  return students.filter((s) => activityMs(s) >= cutoff).length;
}

/** Participants with no recorded activity. */
export function countInactiveParticipants(students) {
  return students.filter((s) => !s.lastActivityAt).length;
}

export function countPendingReviews(submissions) {
  return submissions.filter((s) =>
    [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(s.status)
  ).length;
}

export function countAwaitingResubmit(submissions) {
  return submissions.filter((s) => isLearnerActionRequired(s.status)).length;
}

/**
 * Session recording upload coverage across batches.
 * Returns { expected, uploaded, pct, batchesWithGaps }.
 */
export function computeRecordingCoverage(batches, program) {
  if (!hasProgramRecordingSessions(program)) {
    const total = batches.reduce((n, b) => n + (b.recordings || []).length, 0);
    return { expected: 0, uploaded: total, pct: total > 0 ? 100 : 0, batchesWithGaps: 0 };
  }

  let expected = 0;
  let uploaded = 0;
  let batchesWithGaps = 0;

  batches.forEach((batch) => {
    const recordings = batch.recordings || [];
    const phases = getBatchRecordingPhases(program);
    let batchExpected = 0;
    let batchUploaded = 0;

    phases.forEach((phase) => {
      const sessions = getBatchRecordingSessions(program, phase.id);
      batchExpected += sessions.length;
      sessions.forEach((session) => {
        const hasRec = recordings.some(
          (r) => r.phaseId === phase.id && r.sessionId === session.id && r.url
        );
        if (hasRec) batchUploaded += 1;
      });
    });

    expected += batchExpected;
    uploaded += batchUploaded;
    if (batchExpected > 0 && batchUploaded < batchExpected) batchesWithGaps += 1;
  });

  return {
    expected,
    uploaded,
    pct: expected ? Math.round((uploaded / expected) * 100) : 0,
    batchesWithGaps,
  };
}

/** Recent activity feed from submissions + learner last activity. */
export function buildRecentActivity(students, submissions, limit = 10) {
  const userById = new Map(students.map((s) => [s.id, s]));
  const items = [];

  submissions.forEach((sub) => {
    const ms = submissionMs(sub);
    if (!ms) return;
    const learner = userById.get(sub.userId);
    if (!learner) return;
    items.push({
      id: `sub_${sub.id || sub.userId}_${sub.taskId}`,
      ms,
      type: 'submission',
      learner,
      label: sub.taskTitle || sub.title || 'Task submission',
      status: sub.status,
    });
  });

  students.forEach((learner) => {
    const ms = activityMs(learner);
    if (!ms) return;
    items.push({
      id: `act_${learner.id}`,
      ms,
      type: 'activity',
      learner,
      label: 'Last active in LMS',
      status: null,
    });
  });

  return items
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit);
}

export function formatActivityAge(ms) {
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}

/** Aggregate attendance from pre-fetched batch summaries ({ [userId]: { present, total } }). */
export function aggregateAttendanceStats(summariesByBatch) {
  const rows = Object.values(summariesByBatch || {}).flatMap((map) => Object.values(map || {}));
  const withPct = rows
    .filter((a) => a.total > 0)
    .map((a) => ({
      ...a,
      pct: Math.round((a.present / a.total) * 100),
    }));

  if (!withPct.length) return null;

  const avgPct = Math.round(withPct.reduce((sum, a) => sum + a.pct, 0) / withPct.length);
  const atRisk = withPct.filter((a) => a.pct < 60).length;

  return { avgPct, tracked: withPct.length, atRisk };
}
