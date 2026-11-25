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
    expect(res.groupCounts).toEqual({ G1: 15, G2: 15, G3: 15, none: 0, leftOut: 0 });
  });
});

describe('CMS: split checks Zoho first', () => {
  const zohoDeps = (leads, fail = false) => ({
    getAccessToken: async () => 't',
    getApiDomain: () => 'https://z',
    fetch: async () =>
      fail ? { ok: false, status: 500, json: async () => ({ message: 'down' }) } : { ok: true, status: 200, json: async () => ({ data: leads }) },
  });
  const build = () => {
    const users = { staff: { role: 'cem' } };
    const ids = ['real1', 'real2', 'real3', 'real4', 'test1'];
    users.real1 = { displayName: 'Anisha', email: 'a@x.com', programAccess: { lep: {} } }; // no date in the app yet
    users.real2 = { displayName: 'Bina', email: 'b@x.com', programAccess: { lep: { day1Date: '2026-11-14' } } };
    users.real3 = { displayName: 'Chitra', phoneNumber: '+919800000003', programAccess: { lep: { day1Date: '2026-11-14' } } };
    users.real4 = { displayName: 'Divya', zohoLeadId: 'L4', programAccess: { lep: { day1Date: '2026-11-14' } } };
    // Changed to 14 Nov in the app while testing; Zoho still has 11 Nov. Had a group before.
    users.test1 = {
      displayName: 'App_Test_User',
      email: 't@x.com',
      programAccess: { lep: { day1Date: '2026-11-14', group: { batchId: 'b14', id: 'G1' } } },
    };
    const batch = { id: 'b14', program: 'LEP', day1Date: '2026-11-14', lmsGroupId: 'g14', groups: [{ id: 'G1', name: 'Group 1' }] };
    const leads = [
      { id: 'L1', Full_Name: 'Anisha', Email: 'A@x.com', Lead_Status: 'LEP Enrolled', LEP_Batch: '14/11/2026 - 14/12/2026' },
      { id: 'L2', Full_Name: 'Bina', Email: 'b@x.com', Lead_Status: 'LEP Enrolled', LEP_Batch: '14/11/2026 - 14/12/2026' },
      { id: 'L3', Full_Name: 'Chitra', Mobile: '98000 00003', Lead_Status: 'LEP Enrolled', LEP_Batch: '14/11/2026 - 14/12/2026' },
      { id: 'L4', Full_Name: 'Divya', Lead_Status: 'LEP Enrolled', LEP_Batch: '14/11/2026 - 14/12/2026' },
      { id: 'L5', Full_Name: 'Esha', Email: 'e@x.com', Lead_Status: 'LEP Enrolled' },
    ];
    return { db: fakeDb({ users, batch, group: { memberIds: ids } }), users, batch, leads };
  };
  const req = { auth: { uid: 'staff' }, data: { batchId: 'b14', size: 2 } };

  it('only learners Zoho lists get a group; a test change made only in the app is left out by name', async () => {
    const { db, users, batch, leads } = build();
    const res = await runCmsSplitBatchGroups(db, req, zohoDeps(leads));
    expect(res.groups.reduce((n, g) => n + g.learners, 0)).toBe(4);
    expect(res.leftOut.map((r) => r.name)).toEqual(['App_Test_User']);
    expect(res.zohoOnly).toEqual(['Esha']);
    expect(users.test1.programAccess.lep.group).toBe(null); // its old seat is freed
    expect(batch.groupsLeftOut).toEqual(['test1']);
  });
  it('brings the app copy in line with Zoho on the way (Day 1 and batch text)', async () => {
    const { db, users, leads } = build();
    const res = await runCmsSplitBatchGroups(db, req, zohoDeps(leads));
    expect(users.real1.programAccess.lep.day1Date).toBe('2026-11-14');
    expect(users.real1.programAccess.lep.zohoRawBatch).toBe('14/11/2026 - 14/12/2026');
    expect(res.synced).toBe(4);
  });
  it('Zoho cannot be read: nothing is split', async () => {
    const { db, batch, leads } = build();
    await expect(runCmsSplitBatchGroups(db, req, zohoDeps(leads, true))).rejects.toThrow(/nothing was split/);
    expect(batch.groupsSplitAt).toBeUndefined();
  });
  it('the CMS shows who is in which group, and the left-out learner apart', async () => {
    const { db, leads } = build();
    await runCmsSplitBatchGroups(db, req, zohoDeps(leads));
    const res = await runCmsBatchLearnerCounts(db, { auth: { uid: 'staff' }, data: { batchId: 'b14' } });
    expect(res.groupCounts.leftOut).toBe(1);
    expect(res.groupCounts.none).toBe(0);
    const chitra = res.roster.find((r) => r.name === 'Chitra');
    expect(chitra.phone).toBe('0003');
    expect(['G1', 'G2']).toContain(chitra.group);
    expect(res.roster.find((r) => r.name === 'App_Test_User').group).toBe('leftOut');
  });
});
