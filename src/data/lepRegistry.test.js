import { describe, it, expect } from 'vitest';
import { getProgramAdapter, PROGRAM_ADAPTERS } from './programRegistry';
import { PROGRAMS } from './programTypes';
import { LEP_STATIC_TASKS } from './lepStaticTasks';

describe('LEP program adapter', () => {
  it('is registered as a real program, not a stub', () => {
    const lep = PROGRAM_ADAPTERS[PROGRAMS.LEP];
    expect(lep.hasTasks).toBe(true);
    expect(lep.submissionCollection).toBe('lep_submissions');
  });

  it('exposes the full CX review surface, like 100BM', () => {
    const lep = getProgramAdapter(PROGRAMS.LEP);
    const bm100 = getProgramAdapter(PROGRAMS.BM100);
    // Every capability CX relies on for 100BM must exist for LEP, or CX pages
    // fall back to the MBW adapter and silently review the wrong programme.
    Object.keys(bm100).forEach((key) => {
      expect(typeof lep[key], `LEP adapter is missing "${key}"`).toBe(typeof bm100[key]);
    });
  });

  it('returns the LEP task list, not another programme s', async () => {
    const lep = getProgramAdapter(PROGRAMS.LEP);
    const tasks = await lep.getTasks();
    expect(tasks.length).toBe(LEP_STATIC_TASKS.length);
    expect(tasks.every((t) => t.id.startsWith('lep-'))).toBe(true);
  });

  it('builds submission ids scoped to the learner and task', () => {
    const lep = getProgramAdapter(PROGRAMS.LEP);
    expect(lep.submissionDocId('user1', 'lep-via-survey')).toBe('user1_lep-via-survey');
  });

  it('keeps each programme on its own submission collection', () => {
    const collections = Object.values(PROGRAM_ADAPTERS)
      .map((a) => a.submissionCollection)
      .filter(Boolean);
    expect(new Set(collections).size).toBe(collections.length);
  });
});
