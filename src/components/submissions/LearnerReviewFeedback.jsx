import {
  formatReviewedAt,
  getSubmissionReviewDisplay,
  isLearnerActionRequired,
} from '../../utils/submissionReview';
import { SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * Shows CX review outcome and feedback on the learner task page.
 */
export default function LearnerReviewFeedback({ submission }) {
  if (!submission) return null;

  const display = getSubmissionReviewDisplay(submission);
  const actionRequired = isLearnerActionRequired(submission.status);

  if (!actionRequired && !display.showFeedback && !submission.reviewOutcome) {
    return null;
  }

  if (actionRequired) {
    const reviewedLabel = formatReviewedAt(submission.reviewedAt);
    return (
      <div
        className={`submission-review submission-review--${display.tone} ${display.alertClass || ''}`}
        role="alert"
      >
        <div className="submission-review__head">
          <strong>Review feedback</strong>
          <span className={`mbw-status-pill mbw-status-pill--${display.tone}`}>
            {display.learnerLabel || display.label}
          </span>
          {reviewedLabel && <span className="muted submission-review__date">{reviewedLabel}</span>}
        </div>
        {display.showFeedback ? (
          <p className="submission-review__body">{display.feedback}</p>
        ) : (
          <p className="submission-review__body muted">
            Your CX team has requested changes. Update your submission below and send it again.
          </p>
        )}
        <p className="submission-review__hint muted">
          Review received — please review the feedback and resubmit when you are ready.
        </p>
      </div>
    );
  }

  const reviewedLabel = formatReviewedAt(submission.reviewedAt);

  return (
    <div
      className={`submission-review ${display.alertClass ? `submission-review--${display.tone}` : ''}`}
      role="status"
    >
      <div className="submission-review__head">
        <strong>Review feedback</strong>
        <span className={`mbw-status-pill mbw-status-pill--${display.tone}`}>
          {display.learnerLabel || display.label}
        </span>
        {reviewedLabel && <span className="muted submission-review__date">{reviewedLabel}</span>}
      </div>
      {display.showFeedback ? (
        <p className="submission-review__body">{display.feedback}</p>
      ) : submission.status === SUBMISSION_STATUS.COMPLETED ? (
        <p className="submission-review__body muted">Your submission was approved.</p>
      ) : null}
    </div>
  );
}
