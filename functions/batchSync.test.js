import { describe, it, expect } from 'vitest';
import { planLepLinks, groupDay1, batchName, placeUngrouped } from './batchSync.js';

/**
 * Zoho adds an LEP batch → the CMS has it for grouping without CX doing anything; a learner
 * who reschedules into a grouped batch lands in a group straight away.
 */
const TODAY = '2026-11-11';

describe('Zoho batch → CMS batch', () => {
  it('reads Day 1 from either Zoho batch style', () => {
    expect(groupDay1({ zohoRawBatch: '21 Nov 2026 – 21 Dec 2026' })).toBe('2026-11-21');
    expect(groupDay1({ zohoRawBatch: '21/11/2026 - 21/12/2026' })).toBe('2026-11-21');
    expect(groupDay1({ name: 'LEP · 05 Dec 2026 – 05 Jan 2027' })).toBe('2026-12-05');
  });
  it('a new group for a date the CMS has joins that batch', () => {
    const plan = planLepLinks(
      [{ id: 'g-new', zohoRawBatch: '21 Nov 2026 – 21 Dec 2026', memberCount: 12 }],
      [{ id: 'b21', program: 'LEP', day1Date: '2026-11-21', lmsGroupId: 'g-old' }],
      TODAY
    );
    expect(plan).toEqual([{ groupId: 'g-new', day1: '2026-11-21', action: 'link', batchId: 'b21' }]);
  });
  it('a brand-new Zoho batch date creates one CMS batch, and its second group joins it', () => {
    const plan = planLepLinks(
      [
        { id: 'a', zohoRawBatch: '09 Jan 2027 – 09 Feb 2027', memberCount: 5 },
        { id: 'b', zohoRawBatch: '09/01/2027 - 09/02/2027', memberCount: 1 },
      ],
      [],
      TODAY
    );
    expect(plan.map((p) => p.action)).toEqual(['create', 'link']);
    expect(plan[1].batchId).toBe('new:2027-01-09');
  });
  it('leaves alone: groups already linked, empty groups, finished batches, the CMS QA batch', () => {
    const plan = planLepLinks(
      [
        { id: 'linked', zohoRawBatch: '21 Nov 2026 – x', memberCount: 9 },
        { id: 'empty', zohoRawBatch: '28 Nov 2026 – x', memberCount: 0 },
        { id: 'old', zohoRawBatch: '12 Sep 2026 – x', memberCount: 30 },
        { id: 'qa17', zohoRawBatch: '17 Oct 2026 – x', memberCount: 3 },
      ],
      [
        { id: 'b21', program: 'LEP', day1Date: '2026-11-21', lmsGroupId: 'linked' },
        { id: 'lep-cms-qa-oct2026', program: 'LEP', day1Date: '2026-10-17', lmsGroupId: 'qa-own' },
      ],
      TODAY
    );
    expect(plan.map((p) => [p.groupId, p.action])).toEqual([['qa17', 'create']]);
  });
  it('names batches the way CX do', () => {
    expect(batchName('2026-11-21')).toBe('21st Nov batch');
    expect(batchName('2026-12-12')).toBe('12th Dec batch');
    expect(batchName('2027-01-02')).toBe('2nd Jan batch');
  });
});

describe('learners not in a group yet', () => {
  it('go into the smallest group, one after another', async () => {
    const batch = { id: 'b14', groups: [{ id: 'G1' }, { id: 'G2' }] };
    const inG = (id) => ({ programAccess: { lep: { group: { batchId: 'b14', id } } } });
    const learners = [
      { uid: 'a', data: inG('G1') },
      { uid: 'b', data: inG('G1') },
      { uid: 'c', data: inG('G2') },
      { uid: 'late1', data: {} },
      { uid: 'late2', data: { programAccess: { lep: { group: { batchId: 'old-batch', id: 'G1' } } } } },
    ];
    const writes = {};
    const db = { collection: () => ({ doc: (id) => ({ set: async (p) => (writes[id] = p.programAccess.lep.group.id) }) }) };
    expect(await placeUngrouped(db, batch, learners)).toBe(2);
    expect(writes).toEqual({ late1: 'G2', late2: 'G1' });
  });
  it('a learner the last split left out (not in Zoho for this batch) is not placed', async () => {
    const batch = { id: 'b14', groups: [{ id: 'G1' }], groupsLeftOut: ['test1'] };
    const writes = {};
    const db = { collection: () => ({ doc: (id) => ({ set: async (p) => (writes[id] = p.programAccess.lep.group.id) }) }) };
    expect(await placeUngrouped(db, batch, [{ uid: 'test1', data: {} }, { uid: 'new1', data: {} }])).toBe(1);
    expect(writes).toEqual({ new1: 'G1' });
  });
});
