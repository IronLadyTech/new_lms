import { describe, it, expect } from 'vitest';
import { runCmsSplitBatchGroups, runCmsBatchLearnerCounts } from './cmsBatchLearners.js';

/** CX press "Split into groups" once; every learner gets her group, links CX pasted stay. */
function fakeDb({ users, batch, group }) {
  const writes = {};
  const doc = (coll, id) => ({
    id,
    get: async () => {
      if (coll === 'users') return { exists: id in users, id, data: () => users[id] };
      if (coll === 'cms_batches') return { exists: id === batch.id, id, data: () => batch };
      if (coll === 'groups') return { exists: true, data: () => group };
      return { exists: false, data: () => undefined };
    },
    set: async (patch) => {
      if (coll === 'cms_batches') Object.assign(batch, patch);
      if (coll === 'users' && users[id]) {
        const lep = { ...(users[id].programAccess?.lep || {}), ...(patch.programAccess?.lep || {}) };
        users[id] = { ...users[id], programAccess: { ...(users[id].programAccess || {}), lep } };
      }
      writes[`${coll}/${id}`] = patch;
    },
  });
  return {
    writes,
    collection: (coll) => ({
      doc: (id) => doc(coll, id),
      where: () => ({ get: async () => ({ docs: [] }), limit: () => ({ get: async () => ({ docs: [] }) }) }),
    }),
    getAll: async (...refs) => refs.map((r) => ({ exists: r.id in users, id: r.id, data: () => users[r.id] })),
    batch: () => {
      const ops = [];
      return {
        set: (ref, patch) => ops.push([ref, patch]),
        commit: async () => {
          for (const [ref, patch] of ops) await ref.set(patch);
        },
      };
    },
  };
}

const learnerIds = Array.from({ length: 45 }, (_, i) => `u${String(i).padStart(2, '0')}`);
const setup = () => {
  const users = { staff: { role: 'cem' } };
  for (const id of learnerIds) users[id] = { displayName: id, programAccess: { lep: {} } };
  const batch = {
    id: 'b14',
    program: 'LEP',
    lmsGroupId: 'g14',
    groups: [{ id: 'G1', name: 'Group 1', joinLink: 'https://zoom.us/j/111' }],
  };
  return fakeDb({ users, batch, group: { memberIds: learnerIds } });
};

describe('CMS: split into groups', () => {
  it('45 learners → 3 groups of 15, each learner saved with her group, pasted link kept', async () => {
    const db = setup();
    const res = await runCmsSplitBatchGroups(db, { auth: { uid: 'staff' }, data: { batchId: 'b14', size: 15 } });
    expect(res.groups).toEqual([
      { id: 'G1', name: 'Group 1', learners: 15 },
      { id: 'G2', name: 'Group 2', learners: 15 },
      { id: 'G3', name: 'Group 3', learners: 15 },
    ]);
    expect(db.writes['users/u00']).toEqual({ programAccess: { lep: { group: { batchId: 'b14', id: 'G1' } } } });
    expect(db.writes['cms_batches/b14'].groups[0].joinLink).toBe('https://zoom.us/j/111');
  });
  it('only CMS staff can split', async () => {
    const db = setup();
    await expect(runCmsSplitBatchGroups(db, { auth: { uid: 'u00' }, data: { batchId: 'b14' } })).rejects.toThrow();
  });
  it('the CMS sees how many are in each group', async () => {
    const db = setup();
    await runCmsSplitBatchGroups(db, { auth: { uid: 'staff' }, data: { batchId: 'b14', size: 15 } });
    const res = await runCmsBatchLearnerCounts(db, { auth: { uid: 'staff' }, data: { batchId: 'b14' } });
    expect(res.groupCounts).toEqual({ G1: 15, G2: 15, G3: 15, none: 0 });
  });
});
