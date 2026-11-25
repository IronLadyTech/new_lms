import { describe, it, expect } from 'vitest';
import { batchGroupIds, learnersForBatch } from './cmsBatchLearners.js';
import { syncBatchCalendar } from './cmsCalendarSync.js';

/**
 * One batch, several LMS groups. Zoho sync makes two groups for the same dates; the cohort
 * (37 learners) sat in the one the CMS batch was not linked to, so reminders reached 3.
 */

function fakeDb({ groups = {}, chosen = {}, users = {}, events = {} } = {}) {
  const writes = { set: {}, del: [] };
  const db = {
    writes,
    collection: (name) => ({
      doc: (id) => ({
        id,
        get: async () => {
          if (name === 'groups') return { exists: id in groups, data: () => groups[id] };
          return { exists: id in users, id, data: () => users[id] };
        },
      }),
      where: (field, _op, value) => ({
        limit: () => ({
          get: async () => ({ docs: (chosen[value] || []).map((uid) => ({ id: uid })) }),
        }),
        get: async () => ({
          docs: Object.entries(events)
            .filter(([, e]) => e[field.split('.').pop()] === value)
            .map(([id, data]) => ({ id, data: () => data })),
        }),
      }),
    }),
    getAll: async (...refs) => refs.map((r) => ({ exists: r.id in users, id: r.id, data: () => users[r.id] })),
    batch: () => ({
      set: (ref, data) => (writes.set[ref.id] = data),
      delete: (ref) => writes.del.push(ref.id),
      commit: async () => {},
    }),
  };
  return db;
}

describe('which groups a batch covers', () => {
  it('main group first, then the others, no repeats or blanks', () => {
    expect(batchGroupIds({ lmsGroupId: 'a', lmsGroupIds: ['b', 'a', '', null] })).toEqual(['a', 'b']);
    expect(batchGroupIds({ lmsGroupIds: ['b'] })).toEqual(['b']);
    expect(batchGroupIds({})).toEqual([]);
  });
});

describe('learners of a batch with two groups', () => {
  it('everyone in either group, and everyone who picked either in the app, once', async () => {
    const db = fakeDb({
      groups: { old: { memberIds: ['u1', 'u2'] }, cohort: { memberIds: ['u2', 'u3', 'u4'] } },
      chosen: { old: ['u5'], cohort: ['u1'] },
      users: { u1: {}, u2: {}, u3: {}, u4: {}, u5: {} },
    });
    const learners = await learnersForBatch(db, { program: 'LEP', lmsGroupId: 'old', lmsGroupIds: ['cohort'] });
    expect(learners.map((l) => l.uid).sort()).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
  });
  it('a batch with only the main group works as before', async () => {
    const db = fakeDb({ groups: { old: { memberIds: ['u1'] } }, users: { u1: {} } });
    expect((await learnersForBatch(db, { program: 'LEP', lmsGroupId: 'old' })).map((l) => l.uid)).toEqual(['u1']);
  });
});

describe('web LMS calendar for a batch with two groups', () => {
  it('each group gets the sessions; the main group keeps its original event ids', async () => {
    const db = fakeDb();
    const batch = {
      name: '24th Oct batch',
      lmsGroupId: 'old',
      lmsGroupIds: ['cohort'],
      sessions: [{ code: 'S1', date: '2026-10-24', title: 'Day 1' }],
    };
    const r = await syncBatchCalendar(db, 'b1', batch);
    expect(r.sessions).toBe(2);
    expect(db.writes.set.cms_b1_S1.batchId).toBe('old');
    expect(db.writes.set['cms_b1_S1__cohort'].batchId).toBe('cohort');
  });
});
