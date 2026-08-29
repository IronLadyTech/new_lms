import { describe, it, expect } from 'vitest';
import { weeklyCompletions, dailyCompletions, mergeSubmissions } from './weeklyActivity';

/**
 * This panel exists because the prototype's "Hours spent" could not be built
 * honestly — nothing in the product records duration. So every number here has
 * to come from a submission that really exists, and the tests are mostly about
 * refusing to invent one.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-29T12:00:00.000Z');
const ago = (days) => new Date(NOW - days * DAY).toISOString();

const sub = (status, days) => ({ status, submittedAt: ago(days) });

describe('weeklyCompletions', () => {
  it('counts only what the learner actually sent', () => {
    const r = weeklyCompletions(
      {
        a: sub('submitted', 1),
        b: sub('completed', 3),
        c: sub('under_review', 6),
        d: sub('unlocked', 2), // opened, never sent
        e: sub('locked', 2),
      },
      NOW
    );
    expect(r.thisWeek).toBe(3);
  });

  it('splits this week from the week before', () => {
    const r = weeklyCompletions(
      { a: sub('submitted', 2), b: sub('submitted', 9), c: sub('submitted', 12) },
      NOW
    );
    expect(r.thisWeek).toBe(1);
    expect(r.lastWeek).toBe(2);
    expect(r.delta).toBe(-50);
  });

  it('gives no percentage when there is no prior week to compare with', () => {
    // A first week is not "up 100%" — there is nothing to be up from, and
    // inventing a figure is exactly what this panel replaced.
    const r = weeklyCompletions({ a: sub('submitted', 1) }, NOW);
    expect(r.lastWeek).toBe(0);
    expect(r.delta).toBeNull();
  });

  it('ignores anything older than a fortnight', () => {
    const r = weeklyCompletions({ a: sub('submitted', 30) }, NOW);
    expect(r).toEqual({ thisWeek: 0, lastWeek: 0, delta: null });
  });

  it('ignores a timestamp in the future rather than counting it', () => {
    const r = weeklyCompletions({ a: { status: 'submitted', submittedAt: ago(-3) } }, NOW);
    expect(r.thisWeek).toBe(0);
  });

  it('survives a submission with no timestamp or a broken one', () => {
    const r = weeklyCompletions(
      {
        a: { status: 'submitted' },
        b: { status: 'submitted', submittedAt: 'not a date' },
        c: { status: 'submitted', submittedAt: null },
        d: sub('submitted', 1),
      },
      NOW
    );
    expect(r.thisWeek).toBe(1);
  });

  it('reads a Firestore Timestamp as well as an ISO string', () => {
    const ms = NOW - 2 * DAY;
    const r = weeklyCompletions(
      { a: { status: 'submitted', submittedAt: { toMillis: () => ms } } },
      NOW
    );
    expect(r.thisWeek).toBe(1);
  });

  it('returns zeroes for an empty or missing map', () => {
    expect(weeklyCompletions({}, NOW).thisWeek).toBe(0);
    expect(weeklyCompletions(null, NOW).thisWeek).toBe(0);
    expect(weeklyCompletions(undefined, NOW).delta).toBeNull();
  });
});

describe('dailyCompletions', () => {
  it('returns seven days, oldest first', () => {
    const days = dailyCompletions({}, NOW);
    expect(days).toHaveLength(7);
    expect(days[0].date.getTime()).toBeLessThan(days[6].date.getTime());
  });

  it('draws real zeroes for a quiet week rather than a shape', () => {
    expect(dailyCompletions({}, NOW).every((d) => d.count === 0)).toBe(true);
  });

  it('puts each completion on its own day', () => {
    const days = dailyCompletions({ a: sub('submitted', 0), b: sub('submitted', 0), c: sub('submitted', 2) }, NOW);
    expect(days[6].count).toBe(2);
    expect(days[4].count).toBe(1);
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(3);
  });
});

describe('mergeSubmissions', () => {
  it('combines the three programme engines into one map', () => {
    const merged = mergeSubmissions({ 'mbw-1': sub('submitted', 1) }, { 'bm100-1': sub('submitted', 1) }, {
      'lep-1': sub('submitted', 1),
    });
    expect(Object.keys(merged)).toHaveLength(3);
    expect(weeklyCompletions(merged, NOW).thisWeek).toBe(3);
  });

  it('tolerates an engine that has not loaded yet', () => {
    const merged = mergeSubmissions({ 'mbw-1': sub('submitted', 1) }, null, undefined);
    expect(Object.keys(merged)).toHaveLength(1);
  });
});
