import { describe, it, expect } from 'vitest';
import { lessonFilterCounts, lessonSubmissionTag, matchesLessonFilter } from './lessonFilters';
import { SUBMISSION_STATUS as S, TASK_TYPES as T } from '../services/mbwService';

/**
 * Course content filters and row tags.
 *
 * CX review stays, so "submitted" has three states behind it (in, in review,
 * approved) and a fourth that is not submitted at all from the learner's side:
 * sent back. These pin where each one lands.
 */

const DONE = new Set([S.SUBMITTED, S.UNDER_REVIEW, S.COMPLETED]);

const lesson = (type, status) => ({
  task: { id: `${type}-${status}`, type },
  status,
  isComplete: DONE.has(status),
  submission: status === S.LOCKED || status === S.UNLOCKED ? null : { status },
});

describe('the tag on a lesson row', () => {
  it('marks an assignment handed in as Submitted, in review and once approved too', () => {
    for (const status of [S.SUBMITTED, S.UNDER_REVIEW, S.COMPLETED]) {
      expect(lessonSubmissionTag(lesson(T.EDITABLE_TEMPLATE, status)), status).toEqual({
        tone: 'ok',
        label: 'Submitted',
      });
    }
  });

  it('marks work CX sent back as Needs changes', () => {
    for (const status of [S.NEEDS_IMPROVEMENT, S.REJECTED]) {
      expect(lessonSubmissionTag(lesson(T.FILE_UPLOAD, status))?.label, status).toBe(
        'Needs changes'
      );
    }
  });

  it('tags nothing the learner has not sent', () => {
    expect(lessonSubmissionTag(lesson(T.EDITABLE_TEMPLATE, S.UNLOCKED))).toBeNull();
    expect(lessonSubmissionTag(lesson(T.EDITABLE_TEMPLATE, S.LOCKED))).toBeNull();
  });

  it('does not call a finished checklist "Submitted"', () => {
    expect(lessonSubmissionTag(lesson(T.CHECKLIST, S.COMPLETED))).toBeNull();
  });
});

describe('the filters', () => {
  const lessons = [
    lesson(T.EDITABLE_TEMPLATE, S.UNLOCKED), // to do
    lesson(T.EDITABLE_TEMPLATE, S.NEEDS_IMPROVEMENT), // to do: sent back
    lesson(T.EDITABLE_TEMPLATE, S.SUBMITTED), // submitted
    lesson(T.FILE_UPLOAD, S.COMPLETED), // submitted
    lesson(T.CHECKLIST, S.COMPLETED), // finished, not submitted
    lesson(T.EDITABLE_TEMPLATE, S.LOCKED), // neither
  ];

  it('puts open, unfinished lessons in To do, including work sent back', () => {
    expect(lessons.filter((l) => matchesLessonFilter(l, 'todo')).map((l) => l.status)).toEqual([
      S.UNLOCKED,
      S.NEEDS_IMPROVEMENT,
    ]);
  });

  it('keeps locked lessons out of To do', () => {
    expect(matchesLessonFilter(lesson(T.EDITABLE_TEMPLATE, S.LOCKED), 'todo')).toBe(false);
  });

  it('puts only handed-in assignments in Submitted', () => {
    expect(
      lessons.filter((l) => matchesLessonFilter(l, 'submitted')).map((l) => l.task.type)
    ).toEqual([T.EDITABLE_TEMPLATE, T.FILE_UPLOAD]);
  });

  it('counts each filter', () => {
    expect(lessonFilterCounts(lessons)).toEqual({ all: 6, todo: 2, submitted: 2 });
  });
});

describe('a resubmitted lesson', () => {
  it('is tagged Resubmitted, and still counts as submitted', () => {
    const resubmitted = {
      ...lesson(T.EDITABLE_TEMPLATE, S.SUBMITTED),
      submission: { status: S.SUBMITTED, versions: [{ version: 1 }, { version: 2 }] },
    };
    expect(lessonSubmissionTag(resubmitted)).toEqual({ tone: 'ok', label: 'Resubmitted' });
    expect(matchesLessonFilter(resubmitted, 'submitted')).toBe(true);
  });
});
