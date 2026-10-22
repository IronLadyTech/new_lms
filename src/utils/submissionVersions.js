import { SUBMISSION_STATUS } from '../services/mbwService';

/**
 * Versions of a learner's hand-in.
 *
 * A submission used to be one answer, overwritten on every submit: whatever a
 * learner sent first was gone the moment they sent again. Each hand-in is now
 * kept as `{ version, submittedAt, data }`, where `data` is the answer alone,
 * so earlier versions stay readable by the learner and by CX.
 *
 * Submissions made before versions existed carry no list. They are read as one
 * version, built from the answer already on the document, so nothing has to be
 * migrated and the first resubmit turns into v2.
 */

/* A generous ceiling: the list lives on one document, which has a size limit. */
export const MAX_VERSIONS = 20;

const HANDED_IN = new Set([
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.UNDER_REVIEW,
  SUBMISSION_STATUS.COMPLETED,
  SUBMISSION_STATUS.NEEDS_IMPROVEMENT,
  SUBMISSION_STATUS.REJECTED,
]);

/* Everything on a submission document that is not the learner's answer. */
const NOT_ANSWER = new Set([
  'id',
  'status',
  'type',
  'submittedAt',
  'updatedAt',
  'createdAt',
  'completedAt',
  'userId',
  'taskId',
  'batchId',
  'versions',
  'reviewHistory',
  'reviewOutcome',
  'feedback',
  'reviewedAt',
  'reviewedBy',
  'reviewStartedAt',
  'reviewStartedBy',
  'watchProgress',
  'watchCompleted',
  '_local',
]);

/* Firestore write sentinels (serverTimestamp, deleteField) are not answers. */
const isSentinel = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value._methodName === 'string';

/** The answer on a submission or a submit payload, and nothing else. */
export function answerSnapshot(source = {}) {
  return Object.fromEntries(
    Object.entries(source || {}).filter(
      ([key, value]) => !NOT_ANSWER.has(key) && value !== undefined && !isSentinel(value)
    )
  );
}

/** Every version handed in, oldest first. An older submission reads as v1. */
export function getSubmissionVersions(submission) {
  if (Array.isArray(submission?.versions) && submission.versions.length) {
    return submission.versions;
  }
  if (submission && HANDED_IN.has(submission.status)) {
    const data = answerSnapshot(submission);
    if (Object.keys(data).length) {
      return [{ version: 1, submittedAt: submission.submittedAt ?? null, data }];
    }
  }
  return [];
}

/** The version list after handing in `payload`: what was there, plus the new one. */
export function appendVersion(previousSubmission, payload) {
  const existing = getSubmissionVersions(previousSubmission);
  return [
    ...existing,
    {
      version: existing.length + 1,
      submittedAt: payload.submittedAt || new Date().toISOString(),
      data: answerSnapshot(payload),
    },
  ];
}

/**
 * Which parts of a form template differ from an earlier version: a question's
 * key, or `field:row:column` for a table cell. Used to mark what a learner has
 * changed while editing. Blank and whitespace-only count as the same.
 */
export function changedTemplateCells(definition, before = {}, after = {}) {
  const changed = new Set();
  const text = (value) => String(value ?? '').trim();
  (definition?.fields || []).forEach((field) => {
    if (field.legacy) return;
    if (field.type === 'table') {
      const was = Array.isArray(before?.[field.key]) ? before[field.key] : [];
      const now = Array.isArray(after?.[field.key]) ? after[field.key] : [];
      now.forEach((row, index) => {
        field.columns.forEach((col) => {
          if (text(was[index]?.[col.key]) !== text(row?.[col.key])) {
            changed.add(`${field.key}:${index}:${col.key}`);
          }
        });
      });
    } else if (text(before?.[field.key]) !== text(after?.[field.key])) {
      changed.add(field.key);
    }
  });
  return changed;
}
