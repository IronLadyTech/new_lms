/** Human-readable MBW labels for UI (week codes like Wk1-12 stay secondary). */

import { SUBMISSION_STATUS } from '../services/mbwService';
import { getSubmissionReviewDisplay, isLearnerActionRequired } from './submissionReview';
import { hasCloudMedia } from './submissionMedia';

export function getModuleLabel(task) {
  const n = (task.order ?? 0) + 1;
  return `Module ${n} — ${task.title}`;
}

export function getWeekCode(task) {
  return task.week || '';
}

export function getPrimaryStatus(status, isComplete) {
  if (isLearnerActionRequired(status)) {
    const display = getSubmissionReviewDisplay({ status });
    return { label: display.learnerLabel || display.label, tone: display.tone };
  }

  if (
    status === SUBMISSION_STATUS.SUBMITTED
    || status === SUBMISSION_STATUS.UNDER_REVIEW
  ) {
    return { label: 'Submitted', tone: 'done' };
  }

  if (isComplete || status === SUBMISSION_STATUS.COMPLETED) {
    return { label: 'Completed', tone: 'done' };
  }

  const display = getSubmissionReviewDisplay({ status });
  if (display.tone !== 'locked' && display.tone !== 'open') {
    return { label: display.label, tone: display.tone };
  }

  if (status === SUBMISSION_STATUS.LOCKED) return { label: 'Locked', tone: 'locked' };
  return { label: 'In progress', tone: 'open' };
}

export function submissionPreview(sub, task) {
  if (!sub) return null;
  if (sub._local) return 'Saved on this device — sync pending';
  if (sub.textValue?.trim()) return sub.textValue.trim().slice(0, 120);
  if (sub.weekEntries?.length) {
    const latest = sub.weekEntries[sub.weekEntries.length - 1];
    const count = (latest?.links || []).length || (latest?.linkValue ? 1 : 0);
    return `${latest?.weekLabel || 'This week'} — ${count} post${count === 1 ? '' : 's'}`;
  }
  if (sub.linkValue?.trim()) return sub.linkValue.trim();
  if (sub.fileName?.trim() && !sub.storageSkipped) return sub.fileName.trim();
  if (sub.storageSkipped && !hasCloudMedia(sub)) {
    return task?.type === 'video_record'
      ? 'Mirror practice saved (upload pending)'
      : 'Step marked complete (upload pending)';
  }
  if (hasCloudMedia(sub)) return sub.fileName?.trim() || 'Video submitted';
  if (sub.templateData?.rows?.length || sub.templateData?.fields) {
    const templateId = sub.templateData?.templateId || task?.templateId;
    if (templateId === 'delta') {
      return sub.templateData?.rows?.length
        ? `Delta table (${sub.templateData.rows.length} milestones)`
        : 'Delta table submitted';
    }
    if (templateId === 'errc') {
      return `ERRC grid (${sub.templateData.rows.length} rows)`;
    }
    if (sub.templateData?.fields) {
      const filled = Object.values(sub.templateData.fields).filter((v) => String(v || '').trim()).length;
      return `Form submitted (${filled} fields)`;
    }
    return `Table submitted (${sub.templateData.rows.length} rows)`;
  }
  if (sub.checkedItems?.length) {
    const total = task?.checklistItems?.length;
    return total ? `${sub.checkedItems.length}/${total} practices done` : `${sub.checkedItems.length} practice(s) done`;
  }
  if (sub.watchCompleted) return 'Video watched';
  return null;
}
