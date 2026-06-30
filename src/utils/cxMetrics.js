import { SUBMISSION_STATUS, taskNeedsReview } from '../services/mbwService';
import { PROGRAMS } from '../data/programTypes';
import { MBW_PROGRAM_SECTIONS } from '../data/mbwProgramStructure';

/** Phases currently live for CX dashboards — avoids diluting metrics with locked future quarters. */
export const CX_ACTIVE_PHASES = {
  [PROGRAMS.MBW]: ['pre-preparation', 'quarter-1'],
  [PROGRAMS.LEP]: [],
  [PROGRAMS.BM100]: [],
};

export function filterCxTasks(tasks, program = PROGRAMS.MBW) {
  const phases = CX_ACTIVE_PHASES[program];
  if (!phases?.length) return tasks;
  const scoped = (tasks || []).filter((t) => phases.includes(t.phase));
  return scoped.length ? scoped : tasks;
}

const MODULE_LABELS = Object.fromEntries(
  MBW_PROGRAM_SECTIONS.map((s) => [s.id, { title: s.title, subtitle: s.subtitle }])
);

/** Group tasks under program modules (Pre-Preparation, Quarter 1, …) in journey order. */
export function groupTasksByModule(tasks = []) {
  const byPhase = {};
  tasks.forEach((t) => {
    const phase = t.phase || 'other';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(t);
  });

  const groups = [];
  MBW_PROGRAM_SECTIONS.forEach((section) => {
    const list = byPhase[section.id];
    if (!list?.length) return;
    groups.push({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      tasks: [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    });
  });

  Object.keys(byPhase).forEach((phase) => {
    if (MBW_PROGRAM_SECTIONS.some((s) => s.id === phase)) return;
    const meta = MODULE_LABELS[phase];
    groups.push({
      id: phase,
      title: meta?.title || phase.replace(/-/g, ' '),
      subtitle: meta?.subtitle || '',
      tasks: [...byPhase[phase]].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    });
  });

  return groups;
}

export function moduleCompletionPct(students, moduleTasks, submissions) {
  if (!students.length || !moduleTasks.length) return 0;
  const done = countCompletedCells(students, moduleTasks, submissions);
  const possible = students.length * moduleTasks.length;
  return possible ? Math.round((done / possible) * 100) : 0;
}

export function buildModuleTaskBreakdown(students, tasks, submissions) {
  const index = buildSubmissionIndex(submissions);
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));

  return groupTasksByModule(tasks).map((mod) => ({
    ...mod,
    completionPct: moduleCompletionPct(students, mod.tasks, submissions),
    taskRows: mod.tasks.map((t) => ({
      task: t,
      completed: students.filter((s) =>
        isCxSubmissionComplete(index[s.id]?.[t.id], taskById[t.id])
      ),
      notCompleted: students.filter(
        (s) => !isCxSubmissionComplete(index[s.id]?.[t.id], taskById[t.id])
      ),
    })),
  }));
}

/** Matches learner MBW completion logic (review off → submitted counts as done). */
export function isCxSubmissionComplete(submission, task) {
  if (!submission) return false;
  const status = submission.status;
  if (status === SUBMISSION_STATUS.COMPLETED) return true;
  const reviewRequired = task?.reviewRequired ?? false;
  if (!taskNeedsReview({ reviewRequired })) {
    return (
      status === SUBMISSION_STATUS.SUBMITTED || status === SUBMISSION_STATUS.UNDER_REVIEW
    );
  }
  return false;
}

export function buildSubmissionIndex(submissions = []) {
  const map = {};
  submissions.forEach((s) => {
    if (!map[s.userId]) map[s.userId] = {};
    map[s.userId][s.taskId] = s;
  });
  return map;
}

export function countCompletedCells(students, tasks, submissions) {
  const index = buildSubmissionIndex(submissions);
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  let done = 0;
  students.forEach((student) => {
    tasks.forEach((task) => {
      const sub = index[student.id]?.[task.id];
      if (isCxSubmissionComplete(sub, taskById[task.id] || task)) done += 1;
    });
  });
  return done;
}
