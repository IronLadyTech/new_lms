import { PROGRAMS } from '../data/programTypes';
import { getBm100StaticTasks } from '../data/bm100StaticTasks';
import { getStaticTasks as getMbwStaticTasks } from '../services/mbwService';

/** Program tasks used to label CX batch session recording slots. */
export function getProgramTasksForRecordings(program) {
  if (program === PROGRAMS.BM100) return getBm100StaticTasks();
  if (program === PROGRAMS.MBW) return getMbwStaticTasks();
  return [];
}

export function hasProgramRecordingSessions(program) {
  return getProgramTasksForRecordings(program).length > 0;
}

/**
 * Sessions / subtasks within a phase that CX can attach a recording to.
 * @returns {{ id: string, title: string, week: string }[]}
 */
export function getBatchRecordingSessions(program, phaseId) {
  if (!phaseId) return [];
  return getProgramTasksForRecordings(program)
    .filter((t) => t.phase === phaseId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      week: t.week || '',
    }));
}

export function getSessionTitle(program, sessionId) {
  if (!sessionId) return '';
  const task = getProgramTasksForRecordings(program).find((t) => t.id === sessionId);
  return task?.title || '';
}

export function findRecordingForSession(recordings, phaseId, sessionId) {
  if (!sessionId) return null;
  const matches = (recordings || []).filter((r) => r.sessionId === sessionId);
  if (!matches.length) return null;

  const phaseMatches = phaseId
    ? matches.filter((r) => !r.phaseId || r.phaseId === phaseId)
    : matches;
  const pool = phaseMatches.length ? phaseMatches : matches;

  return [...pool].sort((a, b) =>
    (b.updatedAt || b.addedAt || '').localeCompare(a.updatedAt || a.addedAt || '')
  )[0];
}

/** CX batch recording URL overrides the static lesson video when present. */
export function applyBatchRecordingsToTaskStates(taskStates, recordings) {
  if (!recordings?.length || !taskStates?.length) return taskStates;

  return taskStates.map((state) => {
    const rec = findRecordingForSession(recordings, state.task.phase, state.task.id);
    if (!rec?.url || rec.url === state.task.videoUrl) return state;

    return {
      ...state,
      task: { ...state.task, videoUrl: rec.url },
    };
  });
}

/** Sort batch recordings to match program session order within a phase. */
export function sortRecordingsBySessionOrder(recordings, program, phaseId) {
  const sessions = getBatchRecordingSessions(program, phaseId);
  const order = Object.fromEntries(sessions.map((s, i) => [s.id, i]));
  return [...recordings].sort((a, b) => {
    const ai = order[a.sessionId] ?? 999;
    const bi = order[b.sessionId] ?? 999;
    if (ai !== bi) return ai - bi;
    return (b.date || b.addedAt || '').localeCompare(a.date || a.addedAt || '');
  });
}
