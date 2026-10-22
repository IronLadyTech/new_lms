import { TASK_TYPES } from '../../services/mbwService';

/**
 * "Day 2 — Strategies and Tactics" → { eyebrow: 'Day 2', name: 'Strategies and Tactics' }.
 *
 * Course content shows the day or week as a small label over the module name.
 * Sections without that prefix ("Program Orientation") get no label rather than
 * an invented one.
 */
export function splitSectionTitle(title = '') {
  const text = String(title || '').trim();
  const at = text.indexOf(' — ');
  if (at <= 0) return { eyebrow: '', name: text };
  return { eyebrow: text.slice(0, at).trim(), name: text.slice(at + 3).trim() };
}

/*
 * What the learner does in a lesson, in their words. Deliberately no durations:
 * no lesson stores one, and the old hints ("~10 min", "~15 min video") were
 * guesses shown as facts.
 */
const ACTION_LABELS = {
  [TASK_TYPES.EDITABLE_TEMPLATE]: 'Fill template',
  [TASK_TYPES.FILE_UPLOAD]: 'Upload files',
  [TASK_TYPES.CHECKLIST]: 'Checklist',
  [TASK_TYPES.TEXT]: 'Written answer',
  [TASK_TYPES.LINK]: 'Share a link',
  [TASK_TYPES.VIDEO_RECORD]: 'Record a video',
  [TASK_TYPES.RECURRING_POST]: 'Weekly post',
};

/** Empty for a watch-only lesson: its "Video" item already says what it is. */
export function taskActionLabel(type) {
  return ACTION_LABELS[type] || '';
}
