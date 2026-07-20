import ErrcReadOnlyTable from '../mbw/ErrcReadOnlyTable';
import { submissionPreview } from '../../utils/mbwDisplay';

function formatSubmissionDate(value) {
  if (!value) return '';
  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

/**
 * Read-only view of a learner submission for CX review.
 */
export default function SubmissionReviewView({ submission, task }) {
  if (!submission) {
    return <p className="muted">No submission found for this task.</p>;
  }

  const preview = submissionPreview(submission, task);
  const mediaUrl =
    submission.videoUrl ||
    submission.recordingUrl ||
    submission.videoURL ||
    (submission.fileType?.startsWith('video/') ? submission.fileUrl : null);
  const audioUrl =
    submission.audioUrl ||
    (submission.fileType?.startsWith('audio/') ? submission.fileUrl : null);
  const submittedLabel = formatSubmissionDate(submission.submittedAt);
  const hasWeekEntries = (submission.weekEntries?.length ?? 0) > 0;
  const isRecurringPost = task?.type === 'recurring_post' || hasWeekEntries;

  return (
    <div className="cx-review-submission">
      {preview && !submission.textValue && !isRecurringPost && (
        <p className="muted cx-review-submission__preview">{preview}</p>
      )}

      {submission.textValue && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Written response</h3>
          <p className="cx-review-text">{submission.textValue}</p>
        </div>
      )}

      {submission.linkValue && !isRecurringPost && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Link</h3>
          <a href={submission.linkValue} target="_blank" rel="noreferrer">
            {submission.linkValue}
          </a>
        </div>
      )}

      {submission.fileUrl && submission.fileUrl !== mediaUrl && submission.fileUrl !== audioUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">File</h3>
          <a href={submission.fileUrl} target="_blank" rel="noreferrer">
            {submission.fileName || 'Download attached file'}
          </a>
        </div>
      )}

      {mediaUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Video</h3>
          <video src={mediaUrl} controls playsInline preload="metadata" className="cx-review-video">
            Your browser cannot play this video.
          </video>
          <a href={mediaUrl} target="_blank" rel="noreferrer" className="cx-review-media-link">
            Open video in a new tab
          </a>
        </div>
      )}

      {audioUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Audio</h3>
          <audio src={audioUrl} controls preload="metadata" className="cx-review-audio">
            Your browser cannot play this audio.
          </audio>
        </div>
      )}

      {submission.storageSkipped && !mediaUrl && !audioUrl && (
        <div className="alert alert-warning cx-review-upload-missing" role="status">
          <strong>Video is not available to CX.</strong>
          <span>
            This recording was saved only on the learner&apos;s device because cloud upload was
            unavailable. Ask the learner to reopen the task and upload or record it again.
          </span>
        </div>
      )}

      {submission.templateData?.rows && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Template</h3>
          <ErrcReadOnlyTable rows={submission.templateData.rows} />
        </div>
      )}

      {submission.weekEntries?.length > 0 && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Weekly posts</h3>
          <ul className="cx-batch-list">
            {submission.weekEntries.map((e, i) => (
              <li key={i} className="cx-batch-row cx-batch-row--static">
                <span className="cx-batch-row__name">{e.weekLabel}</span>
                <span className="cx-batch-row__count">
                  {(e.links || [e.linkValue]).filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submission.checkedItems?.length > 0 && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Checklist</h3>
          <ul className="cx-review-checklist">
            {submission.checkedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {submittedLabel && (
        <p className="muted cx-review-submission__meta">
          Submitted {submittedLabel}
        </p>
      )}
    </div>
  );
}
