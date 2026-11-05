import { describe, it, expect } from 'vitest';
import { learnersForBatch } from './cmsBatchLearners.js';

/**
 * She reschedules (CX changes Zoho, or she picks a new date in the app): her own LEP Day 1
 * changes at once, the group membership only at the next Zoho batch sync. Reminders must
 * follow her own date — not the old batch's sessions, and not nothing for the new one.
 */
function fakeDb({ groups = {}, users = {}, batches = {} }) {
  const userDocs = (pred) =>
    Object.entries(users).filter(([, u]) => pred(u)).map(([id]) => ({ id }));
  return {
    collection: (name) => ({
      doc: (id) => ({ id, get: async () => ({ exists: id in groups, data: () => groups[id] }) }),
      where: (field, _op, value) => {
        const run = async () => {
          if (name === 'cms_batches')
            return { docs: Object.entries(batches).filter(([, b]) => b[field] === value).map(([id, data]) => ({ id, data: () => data })) };
          const path = field.split('.');
          return { docs: userDocs((u) => path.reduce((o, k) => (o || {})[k], u) === value) };
        };
        return { get: run, limit: () => ({ get: run }) };
      },
    }),
    getAll: async (...refs) => refs.map((r) => ({ exists: r.id in users, id: r.id, data: () => users[r.id] })),
  };
}

const lep = (day1Date, extra = {}) => ({ programAccess: { lep: { day1Date, ...extra } } });
const OCT24 = { program: 'LEP', day1Date: '2026-10-24', lmsGroupId: 'g24' };

describe('reminders follow her own Day 1 after a reschedule', () => {
  const users = {
    stays: lep('2026-10-24'),
    movedAway: lep('2026-11-14'), // still in the 24 Oct group until the Zoho sync
    movedIn: lep('2026-10-24'), // still in her old group
    noDate: {},
  };
  const groups = { g24: { memberIds: ['stays', 'movedAway', 'noDate'] } };

  it('drops who moved away, adds who moved in, keeps who has no date of her own', async () => {
    const db = fakeDb({ groups, users, batches: { b24: OCT24 } });
    const got = (await learnersForBatch(db, { id: 'b24', ...OCT24 })).map((l) => l.uid).sort();
    expect(got).toEqual(['movedIn', 'noDate', 'stays']);
  });

  it('a second linked batch on the same date (the CMS QA batch) never pulls in the cohort by date', async () => {
    const db = fakeDb({
      groups: { ...groups, qa: { memberIds: [] } },
      users,
      batches: { b24: OCT24, qa: { program: 'LEP', day1Date: '2026-10-24', lmsGroupId: 'qa' } },
    });
    const qa = (await learnersForBatch(db, { id: 'qa', program: 'LEP', day1Date: '2026-10-24', lmsGroupId: 'qa' })).map((l) => l.uid);
    expect(qa).toEqual([]);
    // and the real batch still drops the learner who moved away
    const real = (await learnersForBatch(db, { id: 'b24', ...OCT24 })).map((l) => l.uid);
    expect(real).not.toContain('movedAway');
  });

  it('100BM and MBW are unchanged: the group decides', async () => {
    const db = fakeDb({ groups: { g: { memberIds: ['a'] } }, users: { a: lep('2026-11-14') } });
    const got = await learnersForBatch(db, { id: 'x', program: '100BM', lmsGroupId: 'g' });
    expect(got.map((l) => l.uid)).toEqual(['a']);
  });
});
