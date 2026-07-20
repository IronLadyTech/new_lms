import { useEffect, useState } from 'react';
import ErrcReadOnlyTable from '../mbw/ErrcReadOnlyTable';
import { submissionPreview } from '../../utils/mbwDisplay';
import { getSubmissionBlob, submissionBlobKey } from '../../utils/submissionBlobStore';

function formatSubmissionDate(value) {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function mediaKindFromType(fileType = '') {
  if (fileType.startsWith('audio/')) return 'audio';
  if (fileType.startsWith('video/')) return 'video';
  return 'file';
}

/**
 * Read-only view of the learner's own submission (video, file, text, etc.).
 */
export default function LearnerSubmissionPreview({ submission, task, userId, program = 'mbw' }) {
  const [localBlobUrl, setLocalBlobUrl] = useState(null);
  const [localMeta, setLocalMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    async function loadLocalBlob() {
      if (!userId || !task?.id || !submission) return;

      const hasCloudMedia = Boolean(submission.videoUrl || submission.fileUrl);
      const needsLocal =
        submission.hasLocalRecording ||
        submission.storageSkipped ||
        (submission.fileName && !hasCloudMedia);

      if (!needsLocal || hasCloudMedia) return;

      try {
        const record = await getSubmissionBlob(submissionBlobKey(program, userId, task.id));
        if (cancelled || !record?.blob) return;
        objectUrl = URL.createObjectURL(record.blob);
        setLocalBlobUrl(objectUrl);
        setLocalMeta(record.meta || {});
      } catch {
        /* playback falls back to metadata message */
      }
    }

    loadLocalBlob();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, task?.id, submission, program]);

  if (!submission) return null;

  const preview = submissionPreview(submission, task);
  const submittedLabel = formatSubmissionDate(submission.submittedAt || submission.updatedAt);
  const localKind = localMeta?.kind || mediaKindFromType(submission.fileType || localMeta?.fileType);

  const cloudVideoUrl =
    submission.videoUrl ||
    submission.recordingUrl ||
    (submission.fileType?.startsWith('video/') ? submission.fileUrl : null);

  const videoUrl = cloudVideoUrl || (localKind === 'video' ? localBlobUrl : null);
  const audioUrl =
    submission.audioUrl ||
    (submission.fileType?.startsWith('audio/') ? submission.fileUrl : null) ||
    (localKind === 'audio' ? localBlobUrl : null);

  const fileUrl =
    submission.fileUrl && submission.fileUrl !== cloudVideoUrl && !submission.fileType?.startsWith('audio/')
      ? submission.fileUrl
      : localKind === 'file'
        ? localBlobUrl
        : null;

  const fileName = submission.fileName || localMeta?.fileName || 'Download file';
  const hasWeekEntries = (submission.weekEntries?.length ?? 0) > 0;
  const isRecurringPost = task?.type === 'recurring_post' || hasWeekEntries;

  return (
    <div className="learner-submission-preview">
      {submittedLabel && (
        <p className="muted learner-submission-preview__meta">Submitted {submittedLabel}</p>
      )}

      {preview && !submission.textValue && !videoUrl && !audioUrl && !fileUrl && !isRecurringPost && (
        <p className="muted learner-submission-preview__summary">{preview}</p>
      )}

      {submission.textValue && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Your response</h3>
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

      {videoUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Your recording</h3>
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="cx-review-video mbw-video-record__playback"
          >
            Your browser cannot play this video.
          </video>
          <a href={videoUrl} target="_blank" rel="noreferrer" className="cx-review-media-link">
            Open video in a new tab
          </a>
        </div>
      )}

      {audioUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Your recording</h3>
          <audio src={audioUrl} controls preload="metadata" className="cx-review-audio">
            Your browser cannot play this audio.
          </audio>
        </div>
      )}

      {fileUrl && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Uploaded file</h3>
          <a href={fileUrl} target="_blank" rel="noreferrer" download={fileName}>
            {fileName}
          </a>
        </div>
      )}

      {!videoUrl && !audioUrl && !fileUrl && (submission.hasLocalRecording || submission.storageSkipped) && (
        <div className="alert alert-warning" role="status">
          <strong>Recording saved on this device only.</strong>
          <span>
            {' '}
            Cloud playback is unavailable. If you no longer see your file here, reopen this task on the
            same device or record and upload again.
          </span>
        </div>
      )}

      {submission.templateData?.rows && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Template</h3>
          <ErrcReadOnlyTable rows={submission.templateData.rows} />
        </div>
      )}

      {hasWeekEntries && (
        <div className="cx-review-block">
          <h3 className="cx-review-block__title">Weekly posts</h3>
          <ul className="mbw-recurring__history learner-submission-preview__weeks">
            {submission.weekEntries.map((entry, index) => (
              <li key={index}>
                <span className="muted">{entry.weekLabel}</span>{' '}
                {(entry.links || [entry.linkValue]).filter(Boolean).map((link, linkIndex) => (
                  <a key={linkIndex} href={link} target="_blank" rel="noreferrer">
                    {link}
                  </a>
                ))}
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

      {(submission.watchCompleted || submission.status === 'completed') &&
        task?.type === 'watch_only' && (
          <div className="cx-review-block">
            <p className="success-text">You completed this session.</p>
          </div>
        )}
    </div>
  );
}
