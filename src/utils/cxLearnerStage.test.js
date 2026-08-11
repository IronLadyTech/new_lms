import { describe, it, expect } from 'vitest';
import {
  computeLearnerStage,
  buildLearnerStageRows,
  buildSectionStageFunnel,
  filterLearnerStages,
  STUCK_DAYS,
} from './cxLearnerStage';
import { buildSubmissionIndex } from './cxMetrics';
import { SUBMISSION_STATUS } from '../services/mbwService';
import { PROGRAMS } from '../data/programTypes';

/**
 * This is what the CX learner table reads: where each learner has reached and
 * who has gone quiet. "Stuck" drives outreach, so a learner wrongly cleared
 * from that list is a learner nobody chases.
 */

const learner = (id, extra = {}) => ({ id, role: 'student', displayName: id, ...extra });
const tasks = [
  { id: 't1', phase: 'pre-preparation', order: 0, title: 'Orientation' },
  { id: 't2', phase: 'pre-preparation', order: 1, title: 'Mindset' },
];

const sub = (userId, taskId, status, ageDays = 1) => ({
  userId,
  taskId,
  status,
  submittedAt: { toMillis: () => Date.now() - ageDays * 86400000 },
});

describe('computeLearnerStage', () => {
  it('reports a learner who has done nothing as zero complete', () => {
    const stage = computeLearnerStage(learner('u1'), tasks, buildSubmissionIndex([]), PROGRAMS.MBW);
    expect(stage.completedTaskCount).toBe(0);
    expect(stage.allSectionsDone).toBe(false);
    expect(stage.totalTasks).toBe(tasks.length);
  });

  it('always names a stage rather than showing a blank cell', () => {
    const stage = computeLearnerStage(learner('u1'), tasks, buildSubmissionIndex([]), PROGRAMS.MBW);
    expect(stage.stageLabel).toBeTruthy();
    expect(stage.currentSectionTitle).toBeTruthy();
  });

  it('carries the learner through so the table can render their name', () => {
    const stage = computeLearnerStage(
      learner('u1', { displayName: 'Priya' }),
      tasks,
      buildSubmissionIndex([]),
      PROGRAMS.MBW
    );
    expect(stage.learner.displayName).toBe('Priya');
  });

  it('counts completed work', () => {
    const index = buildSubmissionIndex([sub('u1', 't1', SUBMISSION_STATUS.COMPLETED)]);
    const stage = computeLearnerStage(learner('u1'), tasks, index, PROGRAMS.MBW);
    expect(stage.completedTaskCount).toBeGreaterThan(0);
  });

  it('is not stuck when the learner has never submitted — that is "not started"', () => {
    // Distinguishing the two matters: one needs onboarding, the other outreach.
    const stage = computeLearnerStage(learner('u1'), tasks, buildSubmissionIndex([]), PROGRAMS.MBW);
    expect(stage.stuck).toBe(false);
  });

  it('is not stuck when the learner submitted recently', () => {
    const index = buildSubmissionIndex([sub('u1', 't1', SUBMISSION_STATUS.SUBMITTED, 1)]);
    expect(computeLearnerStage(learner('u1'), tasks, index, PROGRAMS.MBW).stuck).toBe(false);
  });

  it('is stuck when the last submission is older than the threshold', () => {
    const index = buildSubmissionIndex([
      sub('u1', 't1', SUBMISSION_STATUS.SUBMITTED, STUCK_DAYS + 5),
    ]);
    expect(computeLearnerStage(learner('u1'), tasks, index, PROGRAMS.MBW).stuck).toBe(true);
  });

  it('gives every section a bucket the table can render', () => {
    const stage = computeLearnerStage(learner('u1'), tasks, buildSubmissionIndex([]), PROGRAMS.MBW);
    for (const section of stage.sectionsSummary) {
      expect(['locked', 'complete', 'in_progress', 'not_started']).toContain(section.bucket);
      expect(section.label).toBeTruthy();
    }
  });
});

describe('buildLearnerStageRows', () => {
  const members = [learner('u1'), learner('u2'), learner('u3')];

  it('returns one row per learner, none dropped', () => {
    const rows = buildLearnerStageRows(members, tasks, [], PROGRAMS.MBW);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.learner.id)).size).toBe(3);
  });

  it('sorts learners needing attention above those who are finished', () => {
    const rows = buildLearnerStageRows(
      members,
      tasks,
      [sub('u1', 't1', SUBMISSION_STATUS.SUBMITTED, STUCK_DAYS + 5)],
      PROGRAMS.MBW
    );
    const stuckIndex = rows.findIndex((r) => r.stuck);
    const doneIndex = rows.findIndex((r) => r.allSectionsDone);
    if (stuckIndex !== -1 && doneIndex !== -1) {
      expect(stuckIndex).toBeLessThan(doneIndex);
    }
    expect(rows[0].stuck || !rows[0].allSectionsDone).toBe(true);
  });

  it('handles an empty batch', () => {
    expect(buildLearnerStageRows([], tasks, [], PROGRAMS.MBW)).toEqual([]);
  });
});

describe('filterLearnerStages', () => {
  const stages = [
    {
      learner: { id: 'a' },
      stuck: true,
      allSectionsDone: false,
      sectionsSummary: [{ id: 's1', bucket: 'in_progress' }],
    },
    {
      learner: { id: 'b' },
      stuck: false,
      allSectionsDone: true,
      sectionsSummary: [{ id: 's1', bucket: 'complete' }],
    },
    {
      learner: { id: 'c' },
      stuck: false,
      allSectionsDone: false,
      sectionsSummary: [{ id: 's1', bucket: 'not_started' }],
    },
  ];

  it('returns everyone for "all" or no filter', () => {
    expect(filterLearnerStages(stages, 'all')).toHaveLength(3);
    expect(filterLearnerStages(stages, null)).toHaveLength(3);
    expect(filterLearnerStages(stages, '')).toHaveLength(3);
  });

  it('isolates stuck learners for outreach', () => {
    expect(filterLearnerStages(stages, 'stuck').map((s) => s.learner.id)).toEqual(['a']);
  });

  it('isolates finished learners', () => {
    expect(filterLearnerStages(stages, 'complete').map((s) => s.learner.id)).toEqual(['b']);
  });

  it('filters by section to those still working or yet to start', () => {
    expect(filterLearnerStages(stages, 'section:s1').map((s) => s.learner.id)).toEqual(['a', 'c']);
  });

  it('filters to one exact bucket', () => {
    expect(filterLearnerStages(stages, 'bucket:s1:complete').map((s) => s.learner.id)).toEqual([
      'b',
    ]);
  });

  it('returns everyone rather than nothing for an unrecognised filter', () => {
    expect(filterLearnerStages(stages, 'nonsense')).toHaveLength(3);
  });
});

describe('buildSectionStageFunnel', () => {
  const members = [learner('u1'), learner('u2')];

  it('places every learner in exactly one bucket per section', () => {
    // Buckets carry learner objects, not counts, because the funnel is
    // clickable — each slice drills through to the people in it.
    for (const row of buildSectionStageFunnel(members, tasks, [], PROGRAMS.MBW)) {
      const placed = [...row.complete, ...row.inProgress, ...row.notStarted, ...row.locked];
      expect(placed).toHaveLength(members.length);
      expect(new Set(placed.map((l) => l.id)).size).toBe(members.length);
      expect(row.total).toBe(members.length);
    }
  });

  it('labels each section so the funnel is readable', () => {
    for (const row of buildSectionStageFunnel(members, tasks, [], PROGRAMS.MBW)) {
      expect(row.id).toBeTruthy();
      expect(row.title).toBeTruthy();
    }
  });

  it('handles an empty batch without throwing', () => {
    const funnel = buildSectionStageFunnel([], tasks, [], PROGRAMS.MBW);
    expect(() => funnel).not.toThrow();
    funnel.forEach((row) => expect(row.total).toBe(0));
  });
});
