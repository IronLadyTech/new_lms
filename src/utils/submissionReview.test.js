import { describe, expect, it } from 'vitest';
import {
  REVIEW_OUTCOME,
  canLearnerResubmit,
  getReviewOutcomeMeta,
  getSubmissionReviewDisplay,
  statusForReviewOutcome,
  submissionUnlocksNext,
} from './submissionReview.js';
import { SUBMISSION_STATUS } from '../services/mbwService.js';

describe('statusForReviewOutcome', () => {
  it('maps CX outcomes to learner statuses', () => {
    expect(statusForReviewOutcome(REVIEW_OUTCOME.APPROVED)).toBe(SUBMISSION_STATUS.COMPLETED);
    expect(statusForReviewOutcome(REVIEW_OUTCOME.NEEDS_IMPROVEMENT)).toBe(
      SUBMISSION_STATUS.NEEDS_IMPROVEMENT
    );
    expect(statusForReviewOutcome(REVIEW_OUTCOME.REJECTED)).toBe(SUBMISSION_STATUS.REJECTED);
  });
});

describe('getReviewOutcomeMeta', () => {
  it('returns labels for known outcomes', () => {
    expect(getReviewOutcomeMeta(REVIEW_OUTCOME.APPROVED)?.label).toBe('Approved');
    expect(getReviewOutcomeMeta('unknown')).toBeNull();
  });
});

describe('getSubmissionReviewDisplay', () => {
  it('handles empty submission', () => {
    expect(getSubmissionReviewDisplay(null).label).toBe('Not started');
  });

  it('prefers reviewOutcome metadata when present', () => {
    const display = getSubmissionReviewDisplay({
      status: SUBMISSION_STATUS.COMPLETED,
      reviewOutcome: REVIEW_OUTCOME.APPROVED,
    });
    expect(display.label).toBe('Approved');
    expect(display.tone).toBe('done');
  });
});

describe('submissionUnlocksNext / canLearnerResubmit', () => {
  it('unlocks next after submitted or completed', () => {
    expect(submissionUnlocksNext(SUBMISSION_STATUS.SUBMITTED)).toBe(true);
    expect(submissionUnlocksNext(SUBMISSION_STATUS.COMPLETED)).toBe(true);
    expect(submissionUnlocksNext(SUBMISSION_STATUS.LOCKED)).toBe(false);
  });

  it('allows resubmit for unlocked and revision states', () => {
    expect(canLearnerResubmit(SUBMISSION_STATUS.UNLOCKED)).toBe(true);
    expect(canLearnerResubmit(SUBMISSION_STATUS.NEEDS_IMPROVEMENT)).toBe(true);
    expect(canLearnerResubmit(SUBMISSION_STATUS.REJECTED)).toBe(true);
    expect(canLearnerResubmit(SUBMISSION_STATUS.COMPLETED)).toBe(false);
  });
});
