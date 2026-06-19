/** Human-readable MBW labels for UI (week codes like Wk1-12 stay secondary). */

export function getModuleLabel(task) {
  const n = (task.order ?? 0) + 1;
  return `Module ${n} — ${task.title}`;
}

export function getWeekCode(task) {
  return task.week || '';
}

import { MBW_REVIEW_ENABLED } from '../services/mbwService';

export function getPrimaryStatus(status, isComplete, reviewRequired) {
  if (isComplete) return { label: 'Completed', tone: 'done' };
  if (status === 'under_review' && MBW_REVIEW_ENABLED && reviewRequired) {
    return { label: 'Under review', tone: 'review' };
  }
  if (status === 'under_review') return { label: 'Completed', tone: 'done' };
  if (status === 'submitted') return { label: 'Submitted', tone: 'pending' };
  if (status === 'locked') return { label: 'Locked', tone: 'locked' };
  return { label: 'In progress', tone: 'open' };
}

export function submissionPreview(sub, task) {
  if (!sub) return null;
  if (sub._local) return 'Saved on this device — sync pending';
  if (sub.textValue?.trim()) return sub.textValue.trim().slice(0, 120);
  if (sub.linkValue?.trim()) return sub.linkValue.trim();
  if (sub.fileName?.trim() && !sub.storageSkipped) return sub.fileName.trim();
  if (sub.storageSkipped) {
    return task?.type === 'video_record'
      ? 'Mirror practice saved (upload pending)'
      : 'Step marked complete (upload pending)';
  }
  if (sub.videoUrl) return 'Video submitted';
  if (sub.templateData?.rows?.length) return `ERRC grid (${sub.templateData.rows.length} rows)`;
  if (sub.weekEntries?.length) return `${sub.weekEntries.length} week(s) of posts`;
  if (sub.checkedItems?.length) {
    const total = task?.checklistItems?.length;
    return total ? `${sub.checkedItems.length}/${total} practices done` : `${sub.checkedItems.length} practice(s) done`;
  }
  if (sub.watchCompleted) return 'Video watched';
  if (task?.title) return task.title;
  return 'Saved';
}
