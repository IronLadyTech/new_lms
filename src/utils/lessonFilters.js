import { SUBMISSION_STATUS } from '../services/mbwService';
import { getTaskKindLabel } from './taskKindLabel';

/** The course content filters, in the order they are shown. */
export const LESSON_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'submitted', label: 'Submitted' },
];

/* In with CX, or approved by them: the learner has handed it in. */
const HANDED_IN = new Set([
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.UNDER_REVIEW,
  SUBMISSION_STATUS.COMPLETED,
]);

/* CX asked for changes: handed in once, and waiting on the learner again. */
const SENT_BACK = new Set([SUBMISSION_STATUS.NEEDS_IMPROVEMENT, SUBMISSION_STATUS.REJECTED]);

/**
 * The tag a lesson row carries in course content, or null.
 *
 * Only assignments get one. A ticked checklist or a watched video is finished,
 * not "submitted", and tagging it so would blur the one list a learner uses to
 * see what CX has from them.
 */
export function lessonSubmissionTag(taskState) {
  if (!taskState?.submission) return null;
  if (getTaskKindLabel(taskState.task?.type) !== 'Assignment') return null;
  const status = taskState.submission.status;
  if (SENT_BACK.has(status)) return { tone: 'changes', label: 'Needs changes' };
  if (HANDED_IN.has(status)) {
    const resubmitted = (taskState.submission.versions?.length || 0) > 1;
    return { tone: 'ok', label: resubmitted ? 'Resubmitted' : 'Submitted' };
  }
  return null;
}

/**
 * Whether a lesson belongs in a filter.
 *
 * - To do: open and not finished. Work CX sent back is in here, because it is
 *   the learner's move again.
 * - Submitted: assignments handed in, whether CX has looked yet or approved.
 */
export function matchesLessonFilter(taskState, filter) {
  if (filter === 'todo') {
    return taskState.status !== SUBMISSION_STATUS.LOCKED && !taskState.isComplete;
  }
  if (filter === 'submitted') return lessonSubmissionTag(taskState)?.tone === 'ok';
  return true;
}

/** How many lessons each filter would show. */
export function lessonFilterCounts(taskStates = []) {
  return Object.fromEntries(
    LESSON_FILTERS.map((f) => [
      f.id,
      taskStates.filter((ts) => matchesLessonFilter(ts, f.id)).length,
    ])
  );
}
