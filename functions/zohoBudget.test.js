import { describe, it, expect, beforeEach, vi } from 'vitest';
import budget from './zohoBudget.js';

/**
 * The rule this protects: running out of Zoho quota must never stop a learner
 * signing in. Background work yields first and keeps yielding; work a person is
 * waiting on spends to the very end of the day's allowance.
 */

/** Minimal Firestore stand-in: one counter document. */
function fakeDb(initialSpent = 0) {
  const state = { spent: initialSpent, writes: 0 };
  return {
    state,
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ spent: state.spent }) }),
        set: async (payload) => {
          state.writes += 1;
          const inc = payload?.spent?.__inc ?? 0;
          state.spent += inc;
        },
      }),
    }),
  };
}

// firebase-admin's FieldValue.increment is not available outside the runtime.
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n) => ({ __inc: n }) },
}));

beforeEach(() => budget.__reset());

describe('zohoBudget', () => {
  it('allows background work while there is room', async () => {
    const db = fakeDb(0);
    const r = await budget.canSpend(db, budget.PRIORITY.BACKGROUND, 10);
    expect(r.ok).toBe(true);
  });

  it('stops background work at its share, not at the full budget', async () => {
    const backgroundCeiling = Math.floor(budget.DEFAULT_DAILY_BUDGET * budget.BACKGROUND_SHARE);
    const db = fakeDb(backgroundCeiling);
    const bg = await budget.canSpend(db, budget.PRIORITY.BACKGROUND, 1);
    expect(bg.ok).toBe(false);
    expect(bg.ceiling).toBe(backgroundCeiling);
  });

  it('still lets a learner through after background work has stopped', async () => {
    // The whole point: a poll going quiet must not become a locked-out learner.
    const db = fakeDb(Math.floor(budget.DEFAULT_DAILY_BUDGET * budget.BACKGROUND_SHARE) + 5);
    const essential = await budget.canSpend(db, budget.PRIORITY.ESSENTIAL, 1);
    expect(essential.ok).toBe(true);
  });

  it('refuses everything once the hard ceiling is reached', async () => {
    const db = fakeDb(budget.DEFAULT_DAILY_BUDGET);
    expect((await budget.canSpend(db, budget.PRIORITY.ESSENTIAL, 1)).ok).toBe(false);
    expect((await budget.canSpend(db, budget.PRIORITY.BACKGROUND, 1)).ok).toBe(false);
  });

  it('counts what it spends', async () => {
    const db = fakeDb(0);
    await budget.record(db, 3);
    // The in-memory tally is what enforces the ceiling inside an instance;
    // Firestore only shares it between instances.
    const after = await budget.status(db);
    expect(after.spent).toBeGreaterThanOrEqual(3);
  });

  it('spends down the allowance until background work is refused', async () => {
    const db = fakeDb(0);
    const ceiling = Math.floor(budget.DEFAULT_DAILY_BUDGET * budget.BACKGROUND_SHARE);
    await budget.record(db, ceiling);
    expect((await budget.canSpend(db, budget.PRIORITY.BACKGROUND, 1)).ok).toBe(false);
    expect((await budget.canSpend(db, budget.PRIORITY.ESSENTIAL, 1)).ok).toBe(true);
  });

  it('keeps working when the shared counter cannot be read', async () => {
    const broken = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            throw new Error('firestore down');
          },
          set: async () => {
            throw new Error('firestore down');
          },
        }),
      }),
    };
    // A budget we cannot read must not block a learner.
    await expect(budget.record(broken, 1)).resolves.toBeTypeOf('number');
    const r = await budget.canSpend(broken, budget.PRIORITY.ESSENTIAL, 1);
    expect(r.ok).toBe(true);
  });

  it('reports whether background work is currently stopped', async () => {
    const db = fakeDb(Math.floor(budget.DEFAULT_DAILY_BUDGET * budget.BACKGROUND_SHARE) + 1);
    const s = await budget.status(db);
    expect(s.backgroundStopped).toBe(true);
    expect(s.dailyBudget).toBe(budget.DEFAULT_DAILY_BUDGET);
  });
});
