/**
 * A learner's progress, small enough to live on their own record.
 *
 * The analytics screen asks "how is each learner doing" — needing attention if
 * any task was sent back, finished only if every task is done. That is a
 * judgement about a person across all their tasks, so it cannot be answered by
 * counting submissions; it has to be worked out per learner. Doing that when a
 * dashboard opens means re-reading every learner's whole history every time,
 * which is what makes that screen take minutes.
 *
 * Kept here instead, updated as the learner submits, in the same way the record
 * already carries their streak and last-active date.
 *
 * Counts are grouped by phase because CX only ever looks at some phases at a
 * time; a single total could not answer a question scoped to one of them.
 *
 * This module deliberately imports nothing. The backfill runs under plain Node,
 * which cannot load the app's module graph, and one shared implementation of
 * this arithmetic matters more than avoiding four literal strings — a second
 * copy would eventually disagree with the first. A test asserts these match the
 * canonical statuses, so drift fails the build rather than the dashboards.
 */

/** Work handed over counts as done, whether or not a reviewer has reached it. */
const COMPLETE_STATUSES = ['completed', 'submitted', 'under_review'];

/** Work sent back to the learner. */
const ACTION_STATUSES = ['needs_improvement', 'rejected'];

const isComplete = (submission) => COMPLETE_STATUSES.includes(submission?.status);
const needsAction = (status) => ACTION_STATUSES.includes(status);

/** Shape stored on the user document, per programme. */
export { COMPLETE_STATUSES, ACTION_STATUSES };

export function buildProgressSummary(tasks = [], submissions = []) {
  const byTaskId = new Map();
  (submissions || []).forEach((s) => {
    if (s?.taskId) byTaskId.set(s.taskId, s);
  });

  const phases = {};
  (tasks || []).forEach((task) => {
    const phase = task?.phase || 'unphased';
    if (!phases[phase]) phases[phase] = { total: 0, complete: 0, action: 0 };
    phases[phase].total += 1;

    const submission = byTaskId.get(task.id);
    if (isComplete(submission)) phases[phase].complete += 1;
    if (needsAction(submission?.status)) phases[phase].action += 1;
  });

  return phases;
}

/**
 * Roll a stored summary up to the phases CX is currently showing.
 *
 * Returns null when the summary cannot answer for these phases — a learner
 * recorded before the summary existed, or a phase missing from it. Callers must
 * treat null as "not known" rather than as zero, so a learner is never silently
 * reported as having done nothing.
 */
export function summaryForPhases(summary, phases = []) {
  if (!summary || typeof summary !== 'object') return null;
  if (!phases.length) return null;

  let total = 0;
  let complete = 0;
  let action = 0;

  for (const phase of phases) {
    const entry = summary[phase];
    if (!entry) return null;
    total += entry.total || 0;
    complete += entry.complete || 0;
    action += entry.action || 0;
  }

  return { total, complete, action };
}

/**
 * The same three buckets the task-status chart uses, from a summary alone.
 *
 * Order matters and matches the existing rule exactly: anything sent back wins
 * over everything else, then fully finished, then in progress.
 */
export function classifyFromSummary(summary, phases = []) {
  const rolled = summaryForPhases(summary, phases);
  if (!rolled || !rolled.total) return null;
  if (rolled.action > 0) return 'action';
  if (rolled.complete === rolled.total) return 'done';
  return 'not_started';
}
