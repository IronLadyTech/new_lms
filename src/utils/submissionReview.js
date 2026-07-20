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
  const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toMillis?.() || null;
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
