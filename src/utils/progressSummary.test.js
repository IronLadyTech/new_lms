import { describe, it, expect } from 'vitest';
import { buildProgressSummary, summaryForPhases, classifyFromSummary } from './progressSummary';
import { classifyLearnerTaskStatus, TASK_STATUS_LABELS } from './cxDrilldown';
import { buildSubmissionIndex } from './cxMetrics';

const tasks = [
  { id: 't1', phase: 'pre-preparation' },
  { id: 't2', phase: 'pre-preparation' },
  { id: 't3', phase: 'quarter-1' },
  { id: 't4', phase: 'quarter-2' },
];
const PHASES = ['pre-preparation', 'quarter-1'];

const sub = (taskId, status) => ({ taskId, userId: 'u1', status });

describe('buildProgressSummary', () => {
  it('counts per phase, not as one total', () => {
    const summary = buildProgressSummary(tasks, [sub('t1', 'completed'), sub('t3', 'submitted')]);
    expect(summary['pre-preparation']).toEqual({ total: 2, complete: 1, action: 0 });
    expect(summary['quarter-1']).toEqual({ total: 1, complete: 1, action: 0 });
    expect(summary['quarter-2']).toEqual({ total: 1, complete: 0, action: 0 });
  });

  it('treats submitted and under review as complete, matching the existing rule', () => {
    const summary = buildProgressSummary(tasks, [
      sub('t1', 'submitted'),
      sub('t2', 'under_review'),
    ]);
    expect(summary['pre-preparation'].complete).toBe(2);
  });

  it('counts work sent back as needing action', () => {
    const summary = buildProgressSummary(tasks, [sub('t1', 'needs_improvement')]);
    expect(summary['pre-preparation'].action).toBe(1);
    expect(summary['pre-preparation'].complete).toBe(0);
  });

  it('ignores submissions for tasks that are not in the catalogue', () => {
    const summary = buildProgressSummary(tasks, [sub('retired-task', 'completed')]);
    expect(summary['pre-preparation'].complete).toBe(0);
  });
});

describe('summaryForPhases', () => {
  it('adds up only the phases asked for', () => {
    const summary = buildProgressSummary(tasks, [sub('t1', 'completed'), sub('t4', 'completed')]);
    // t4 is quarter-2 and must not be counted.
    expect(summaryForPhases(summary, PHASES)).toEqual({ total: 3, complete: 1, action: 0 });
  });

  it('reports not-known rather than zero when a phase is missing', () => {
    expect(summaryForPhases({ 'pre-preparation': { total: 2, complete: 1 } }, PHASES)).toBeNull();
    expect(summaryForPhases(null, PHASES)).toBeNull();
    expect(summaryForPhases(undefined, PHASES)).toBeNull();
  });
});

/**
 * The summary exists to replace a calculation that reads every submission. If
 * the two ever disagree the dashboards silently change, so they are compared
 * directly here rather than each being checked against expectations separately.
 */
describe('agreement with the calculation it replaces', () => {
  const cases = [
    { name: 'nothing submitted', subs: [] },
    { name: 'part way through', subs: [sub('t1', 'completed')] },
    {
      name: 'everything in the active phases done',
      subs: [sub('t1', 'completed'), sub('t2', 'completed'), sub('t3', 'completed')],
    },
    { name: 'one task sent back', subs: [sub('t1', 'completed'), sub('t2', 'needs_improvement')] },
    {
      name: 'sent back and everything else done',
      subs: [sub('t1', 'completed'), sub('t2', 'completed'), sub('t3', 'rejected')],
    },
    { name: 'only an inactive phase done', subs: [sub('t4', 'completed')] },
  ];

  for (const { name, subs } of cases) {
    it(`agrees when ${name}`, () => {
      const activeTasks = tasks.filter((t) => PHASES.includes(t.phase));
      const index = buildSubmissionIndex(subs.map((s) => ({ ...s, userId: 'u1' })));
      const fromSubmissions = classifyLearnerTaskStatus({ id: 'u1' }, activeTasks, index);

      const summary = buildProgressSummary(tasks, subs);
      const fromSummary = classifyFromSummary(summary, PHASES);

      // Both describe the same learner; only the route to the answer differs.
      const expected = {
        [TASK_STATUS_LABELS.ACTION]: 'action',
        [TASK_STATUS_LABELS.DONE]: 'done',
        [TASK_STATUS_LABELS.NOT_STARTED]: 'not_started',
      }[fromSubmissions];

      expect(fromSummary, `summary said ${fromSummary}, submissions said ${fromSubmissions}`).toBe(
        expected
      );
    });
  }
});

/**
 * The summary module imports nothing so the backfill can run under plain Node.
 * That means it restates the statuses, so this guards the copy: if the canonical
 * list changes, this fails rather than the dashboards quietly drifting.
 */
describe('status values stay in step with the rest of the product', () => {
  it('matches what the product treats as complete and as needing action', async () => {
    const { COMPLETE_STATUSES, ACTION_STATUSES } = await import('./progressSummary');
    const { SUBMISSION_STATUS } = await import('../services/mbwService');
    const { isCxSubmissionComplete } = await import('./cxMetrics');
    const { isLearnerActionRequired } = await import('./submissionReview');

    for (const status of Object.values(SUBMISSION_STATUS)) {
      expect(COMPLETE_STATUSES.includes(status), `complete: ${status}`).toBe(
        isCxSubmissionComplete({ status })
      );
      expect(ACTION_STATUSES.includes(status), `action: ${status}`).toBe(
        isLearnerActionRequired(status)
      );
    }
  });
});
