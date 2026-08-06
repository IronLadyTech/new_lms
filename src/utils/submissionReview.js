import { SUBMISSION_STATUS } from '../services/mbwService';
import { deleteField } from 'firebase/firestore';

/** CX review outcomes saved on submission docs. */
export const REVIEW_OUTCOME = {
  APPROVED: 'approved',
  NEEDS_IMPROVEMENT: 'needs_improvement',
  REJECTED: 'rejected',
};

const OUTCOME_META = {
  [REVIEW_OUTCOME.APPROVED]: {
    label: 'Approved',
    learnerLabel: 'Approved',
    tone: 'done',
    alertClass: 'alert-success',
  },
  [REVIEW_OUTCOME.NEEDS_IMPROVEMENT]: {
    label: 'Needs improvement',
    learnerLabel: 'Action required',
    tone: 'improvement',
    alertClass: 'alert-warning',
  },
  [REVIEW_OUTCOME.REJECTED]: {
    label: 'Rejected',
    learnerLabel: 'Action required',
    tone: 'rejected',
    alertClass: 'alert-error',
  },
};

/** Map CX outcome → learner submission status. */
export function statusForReviewOutcome(outcome) {
  switch (outcome) {
    case REVIEW_OUTCOME.APPROVED:
      return SUBMISSION_STATUS.COMPLETED;
    case REVIEW_OUTCOME.NEEDS_IMPROVEMENT:
      return SUBMISSION_STATUS.NEEDS_IMPROVEMENT;
    case REVIEW_OUTCOME.REJECTED:
      return SUBMISSION_STATUS.REJECTED;
    default:
      return SUBMISSION_STATUS.UNLOCKED;
  }
}

export function getReviewOutcomeMeta(outcome) {
  return OUTCOME_META[outcome] || null;
}

function submittedDisplay() {
  return { label: 'Submitted', tone: 'done', showFeedback: false };
}

/** Human-readable review state for CX grids and learner pills. */
export function getSubmissionReviewDisplay(submission) {
  if (!submission) return { label: 'Not started', tone: 'locked', showFeedback: false };

  const { status, reviewOutcome, feedback } = submission;

  if (reviewOutcome && OUTCOME_META[reviewOutcome]) {
    const meta = OUTCOME_META[reviewOutcome];
    return {
      label: meta.label,
      tone: meta.tone,
      alertClass: meta.alertClass,
      learnerLabel: meta.learnerLabel,
      showFeedback: Boolean(feedback?.trim()),
      feedback: feedback?.trim() || '',
    };
  }

  if (status === SUBMISSION_STATUS.COMPLETED) {
    return {
      label: 'Approved',
      tone: 'done',
      learnerLabel: 'Approved',
      showFeedback: Boolean(feedback?.trim()),
      feedback: feedback?.trim() || '',
    };
  }
  if (
    status === SUBMISSION_STATUS.SUBMITTED
    || status === SUBMISSION_STATUS.UNDER_REVIEW
  ) {
    return submittedDisplay();
  }
  if (status === SUBMISSION_STATUS.NEEDS_IMPROVEMENT) {
    return {
      label: 'Needs improvement',
      learnerLabel: 'Action required',
      tone: 'improvement',
      alertClass: 'alert-warning',
      showFeedback: Boolean(feedback?.trim()),
      feedback: feedback?.trim() || '',
    };
  }
  if (status === SUBMISSION_STATUS.REJECTED) {
    return {
      label: 'Rejected',
      learnerLabel: 'Action required',
      tone: 'rejected',
      alertClass: 'alert-error',
      showFeedback: Boolean(feedback?.trim()),
      feedback: feedback?.trim() || '',
    };
  }
  if (status === SUBMISSION_STATUS.UNLOCKED) {
    return { label: 'In progress', tone: 'open', showFeedback: false };
  }
  return { label: 'Locked', tone: 'locked', showFeedback: false };
}

/** Legacy helper — submissions no longer wait on CX by default. */
export function isAwaitingCxReview() {
  return false;
}

/** Learner must revise and resubmit after CX feedback. */
export function isLearnerActionRequired(status) {
  return (
    status === SUBMISSION_STATUS.NEEDS_IMPROVEMENT
    || status === SUBMISSION_STATUS.REJECTED
  );
}

export function canLearnerResubmit(status) {
  return (
    status === SUBMISSION_STATUS.UNLOCKED
    || status === SUBMISSION_STATUS.NEEDS_IMPROVEMENT
    || status === SUBMISSION_STATUS.REJECTED
  );
}

/**
 * Learner has finished the work enough to unlock the next lesson.
 * Submitted tasks count as complete unless CX sends back for revision.
 */
export function submissionUnlocksNext(status) {
  // Revision states (needs_improvement / rejected) intentionally excluded: a task
  // sent back for rework is NOT done, must not count toward progress, must not
  // unlock the next lesson, and must remain the learner's resume target.
  return (
    status === SUBMISSION_STATUS.COMPLETED
    || status === SUBMISSION_STATUS.SUBMITTED
    || status === SUBMISSION_STATUS.UNDER_REVIEW
  );
}

export function formatReviewedAt(ts) {
  const ms = reviewedAtMs(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function reviewedAtMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (ts.seconds) return ts.seconds * 1000;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

function normalizeReviewedAtForStorage(ts) {
  const ms = reviewedAtMs(ts);
  return ms ? new Date(ms).toISOString() : new Date().toISOString();
}

/** Single review round stored on a submission doc or in reviewHistory. */
export function buildReviewEntry({ outcome, feedback, reviewedBy, reviewedAt }) {
  return {
    outcome: outcome || '',
    feedback: safeReviewText(feedback),
    reviewedBy: reviewedBy || '',
    reviewedAt: reviewedAt ? normalizeReviewedAtForStorage(reviewedAt) : null,
  };
}

function safeReviewText(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value.trim() : String(value).trim();
}

function reviewEntryKey(entry) {
  const at = entry?.reviewedAt ? String(entry.reviewedAt) : '';
  return `${entry?.outcome || ''}|${at}|${(entry?.feedback || '').slice(0, 48)}`;
}

/** All CX reviews for a submission — persisted history plus the active review fields. */
export function getSubmissionReviewHistory(submission) {
  if (!submission) return [];

  const history = Array.isArray(submission.reviewHistory)
    ? submission.reviewHistory.map((entry) => buildReviewEntry(entry))
    : [];

  if (submission.reviewOutcome || submission.feedback?.trim() || submission.reviewedAt) {
    const current = buildReviewEntry({
      outcome: submission.reviewOutcome,
      feedback: submission.feedback,
      reviewedBy: submission.reviewedBy,
      reviewedAt: submission.reviewedAt,
    });
    const currentKey = reviewEntryKey(current);
    if (!history.some((entry) => reviewEntryKey(entry) === currentKey)) {
      history.push(current);
    }
  }

  return history.sort((a, b) => reviewedAtMs(a.reviewedAt) - reviewedAtMs(b.reviewedAt));
}

/**
 * Preserve the active CX review in reviewHistory when a learner resubmits.
 * CX appends on each review; this covers legacy docs reviewed before history existed.
 */
export function archiveReviewHistoryForResubmit(prevSubmission) {
  if (!prevSubmission) return {};

  const history = Array.isArray(prevSubmission.reviewHistory)
    ? [...prevSubmission.reviewHistory]
    : [];

  if (
    prevSubmission.reviewOutcome
    || prevSubmission.feedback?.trim()
    || prevSubmission.reviewedAt
  ) {
    const current = buildReviewEntry({
      outcome: prevSubmission.reviewOutcome,
      feedback: prevSubmission.feedback,
      reviewedBy: prevSubmission.reviewedBy,
      reviewedAt: prevSubmission.reviewedAt,
    });
    const currentKey = reviewEntryKey(current);
    if (!history.some((entry) => reviewEntryKey(entry) === currentKey)) {
      history.push(current);
    }
  }

  if (history.length === 0) return {};
  return { reviewHistory: history };
}

/** Clear prior CX review metadata when a learner resubmits. */
export function clearReviewFieldsForResubmit(prevSubmission) {
  if (
    !prevSubmission?.reviewOutcome
    && !prevSubmission?.feedback
    && !prevSubmission?.reviewedAt
    && !prevSubmission?.reviewedBy
  ) {
    return {};
  }
  // Clear ALL four review fields together — the security rule only lets a learner
  // touch these keys when it is removing every one of them (never setting a value).
  return {
    reviewOutcome: deleteField(),
    feedback: deleteField(),
    reviewedAt: deleteField(),
    reviewedBy: deleteField(),
  };
}
