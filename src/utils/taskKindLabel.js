import { TASK_TYPES } from '../services/mbwService';

const ASSIGNMENT_TYPES = new Set([
  TASK_TYPES.EDITABLE_TEMPLATE,
  TASK_TYPES.FILE_UPLOAD,
  TASK_TYPES.VIDEO_RECORD,
  TASK_TYPES.RECURRING_POST,
]);

/** Tap-style content kind — consumption vs submission work. */
export function getTaskKindLabel(type) {
  if (ASSIGNMENT_TYPES.has(type)) return 'Assignment';
  return 'Lesson';
}
