import { TASK_TYPES as MBW_TYPES } from '../services/mbwService';

/** Estimated minutes from known task-type hints — not invented wall-clock data. */
export function estimateTaskMinutes(task, taskTypes = MBW_TYPES) {
  if (!task?.type) return 10;
  if (task.type === taskTypes.WATCH_ONLY) return 15;
  if (task.type === taskTypes.VIDEO_RECORD) return 5;
  if (task.type === taskTypes.RECURRING_POST) return 0;
  if (task.type === taskTypes.FILE_UPLOAD) return 10;
  if (task.type === taskTypes.EDITABLE_TEMPLATE) return 10;
  if (task.type === taskTypes.CHECKLIST) return 10;
  if (task.type === taskTypes.TEXT) return 10;
  if (task.type === taskTypes.LINK) return 10;
  return 10;
}

export function estimateCurriculumMinutes(taskStates, taskTypes = MBW_TYPES) {
  if (!Array.isArray(taskStates)) return 0;
  return taskStates.reduce((sum, ts) => sum + estimateTaskMinutes(ts?.task, taskTypes), 0);
}

export function formatCurriculumDuration(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} Hr ${m} mins`;
  if (h > 0) return `${h} Hr`;
  return `${m} mins`;
}

export function countCompletedModules(sectionProgress) {
  if (!sectionProgress || typeof sectionProgress !== 'object') return 0;
  return Object.values(sectionProgress).filter(
    (p) => p?.unlocked && p.total > 0 && p.done >= p.total
  ).length;
}
