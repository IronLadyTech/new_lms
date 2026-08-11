import { describe, it, expect } from 'vitest';
import { parseWeekNumber, buildLessonGroups } from './programOutline';

/**
 * Grouping is presentational only: it must never drop, duplicate, or reorder a
 * task. A learner losing a lesson from the outline is worse than an ugly list.
 */

const task = (week, id = week) => ({ task: { id, week } });

describe('parseWeekNumber', () => {
  it('reads plain week labels', () => {
    expect(parseWeekNumber('Wk1')).toBe(1);
    expect(parseWeekNumber('Wk 12')).toBe(12);
    expect(parseWeekNumber('wk3')).toBe(3);
  });

  it('returns null for labels that are not a single week', () => {
    expect(parseWeekNumber('Wk1-12')).toBeNull();
    expect(parseWeekNumber('Session 3')).toBeNull();
    expect(parseWeekNumber('Prep 1')).toBeNull();
    expect(parseWeekNumber('Live')).toBeNull();
    expect(parseWeekNumber('')).toBeNull();
    expect(parseWeekNumber(null)).toBeNull();
  });
});

describe('buildLessonGroups', () => {
  const weeks = (n) => Array.from({ length: n }, (_, i) => task(`Wk${i + 1}`));

  it('leaves a short list ungrouped', () => {
    const groups = buildLessonGroups(weeks(6));
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it('buckets a long list into blocks', () => {
    const groups = buildLessonGroups(weeks(12), { blockSize: 4 });
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe('Weeks 1–4');
    expect(groups[2].label).toBe('Weeks 9–12');
  });

  it('never loses or duplicates a task', () => {
    const rows = weeks(12);
    const flat = buildLessonGroups(rows).flatMap((g) => g.taskStates);
    expect(flat).toHaveLength(12);
    expect(new Set(flat.map((t) => t.task.id)).size).toBe(12);
  });

  it('preserves the engine ordering exactly', () => {
    const rows = weeks(12);
    const flat = buildLessonGroups(rows).flatMap((g) => g.taskStates);
    expect(flat.map((t) => t.task.id)).toEqual(rows.map((t) => t.task.id));
  });

  it('lets unnumbered rows ride with the block they follow', () => {
    const rows = [
      ...weeks(4),
      task('Session A', 'sA'),
      ...weeks(4).map((t, i) => task(`Wk${i + 5}`)),
    ];
    const flat = buildLessonGroups(rows, { minToGroup: 5 }).flatMap((g) => g.taskStates);
    expect(flat).toHaveLength(rows.length);
    expect(flat.map((t) => t.task.id)).toContain('sA');
  });

  it('stays ungrouped when most rows have no week number', () => {
    const rows = [
      task('Prep 1', 'p1'),
      task('Session 1', 's1'),
      task('Live', 'l1'),
      task('Networking', 'n1'),
      task('Prep 2', 'p2'),
      task('Session 2', 's2'),
      task('Wk1', 'w1'),
      task('Wk2', 'w2'),
      task('Session 3', 's3'),
      task('Session 4', 's4'),
    ];
    expect(buildLessonGroups(rows)).toHaveLength(1);
  });

  it('labels a single-week block without a range dash', () => {
    const rows = [...weeks(9), task('Wk20', 'far')];
    const groups = buildLessonGroups(rows, { blockSize: 4 });
    expect(groups.some((g) => g.label === 'Week 20')).toBe(true);
  });

  it('handles empty and non-array input', () => {
    expect(buildLessonGroups([])).toEqual([{ id: 'all', label: null, taskStates: [] }]);
    expect(buildLessonGroups(null)[0].taskStates).toEqual([]);
  });
});
