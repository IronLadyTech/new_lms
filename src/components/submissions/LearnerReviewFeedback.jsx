import {
  formatReviewedAt,
  getReviewOutcomeMeta,
  getSubmissionReviewHistory,
  isLearnerActionRequired,
} from '../../utils/submissionReview';

function ReviewRound({ entry, round, total, isLatest, actionRequired }) {
  const meta = getReviewOutcomeMeta(entry.outcome);
  const tone = meta?.tone || 'pending';
  const label = meta?.learnerLabel || meta?.label || 'Reviewed';
  const reviewedLabel = formatReviewedAt(entry.reviewedAt);
  const feedback = entry.feedback?.trim();

  return (
    <article
      className={`submission-review__round submission-review__round--${tone} ${
        isLatest && actionRequired ? meta?.alertClass || '' : ''
      }`}
    >
      <div className="submission-review__head">
        <strong>
          {total > 1 ? `Review ${round} of ${total}` : 'Review feedback'}
        </strong>
        <span className={`mbw-status-pill mbw-status-pill--${tone}`}>{label}</span>
        {reviewedLabel && <span className="muted submission-review__date">{reviewedLabel}</span>}
      </div>
      {feedback ? (
        <p className="submission-review__body">{feedback}</p>
      ) : entry.outcome === 'approved' ? (
        <p className="submission-review__body muted">Your submission was approved.</p>
      ) : (
        <p className="submission-review__body muted">
          Your CX team has requested changes. Update your submission below and send it again.
        </p>
      )}
    </article>
  );
}

/**
 * Shows every CX review round on the learner task page.
 */
export default function LearnerReviewFeedback({ submission }) {
  if (!submission) return null;

  const reviews = getSubmissionReviewHistory(submission);
  if (reviews.length === 0) return null;

  const actionRequired = isLearnerActionRequired(submission.status);
  const latestReview = reviews[reviews.length - 1];
  const latestMeta = getReviewOutcomeMeta(latestReview.outcome);
  const containerTone = actionRequired ? latestMeta?.tone || 'improvement' : latestMeta?.tone || 'done';

  return (
    <div
      className={`submission-review submission-review--${containerTone} ${
        actionRequired ? latestMeta?.alertClass || '' : ''
      }`}
      role={actionRequired ? 'alert' : 'status'}
    >
      {reviews.length > 1 && (
        <p className="submission-review__history-label muted">
          {reviews.length} review{reviews.length === 1 ? '' : 's'} on this task
        </p>
      )}

      <div className="submission-review__history">
        {reviews.map((entry, index) => (
          <ReviewRound
            key={`${entry.outcome}-${entry.reviewedAt}-${index}`}
            entry={entry}
            round={index + 1}
            total={reviews.length}
            isLatest={index === reviews.length - 1}
            actionRequired={actionRequired}
          />
        ))}
      </div>

      {actionRequired && (
        <p className="submission-review__hint muted">
          Review received — please review the feedback and resubmit when you are ready.
        </p>
      )}
    </div>
  );
}
