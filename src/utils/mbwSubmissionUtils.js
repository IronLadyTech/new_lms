import { SUBMISSION_STATUS } from '../services/mbwService';

export function hasSubmissionContent(submission) {
  if (!submission || submission.status === SUBMISSION_STATUS.LOCKED) return false;
  return Boolean(
    submission.textValue ||
      submission.linkValue ||
      submission.fileUrl ||
      submission.storageSkipped ||
      submission.videoUrl ||
      submission.templateData ||
      submission.weekEntries?.length ||
      submission.watchCompleted
  );
}

export function filterSavedTaskStates(taskStates) {
  return taskStates.filter((ts) => hasSubmissionContent(ts.submission));
}

export function countSavedSubmissions(taskStates) {
  return filterSavedTaskStates(taskStates).length;
}
