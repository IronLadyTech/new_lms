import { TASK_TYPES } from '../services/mbwService';

/** Resolve cloud media URLs stored on a submission doc. */
export function getSubmissionMediaUrls(submission) {
  if (!submission) {
    return { videoUrl: null, audioUrl: null, fileUrl: null };
  }

  const fileType = typeof submission.fileType === 'string' ? submission.fileType : '';

  const videoUrl =
    submission.videoUrl ||
    submission.recordingUrl ||
    submission.videoURL ||
    (fileType.startsWith('video/') ? submission.fileUrl : null) ||
    null;

  const audioUrl =
    submission.audioUrl || (fileType.startsWith('audio/') ? submission.fileUrl : null) || null;

  const fileUrl =
    submission.fileUrl &&
    submission.fileUrl !== videoUrl &&
    submission.fileUrl !== audioUrl &&
    !fileType.startsWith('audio/') &&
    !fileType.startsWith('video/')
      ? submission.fileUrl
      : null;

  return { videoUrl, audioUrl, fileUrl };
}

export function hasCloudMedia(submission) {
  const { videoUrl, audioUrl, fileUrl } = getSubmissionMediaUrls(submission);
  return Boolean(videoUrl || audioUrl || fileUrl);
}

/** Learner submitted without a cloud file — allow upload/record again. */
export function needsCloudUploadRetry(task, submission) {
  if (!submission || !task) return false;
  if (!submission.storageSkipped && !submission.hasLocalRecording) return false;

  if (task.type === TASK_TYPES.VIDEO_RECORD) {
    return !getSubmissionMediaUrls(submission).videoUrl;
  }
  if (task.type === TASK_TYPES.FILE_UPLOAD) {
    return !hasCloudMedia(submission);
  }
  return false;
}
