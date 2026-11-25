import { describe, it, expect } from 'vitest';
import { learnerGroupId, groupJoinLink, splitIntoGroups, smallestGroup, groupRows } from './batchGroups.js';

/**
 * A 45-learner batch runs as 3 groups of 15, each with its own Zoom room. Each learner must get
 * her own group's link — in reminders and on the Join button — with almost no work for CX.
 */
const learners = (n) => Array.from({ length: n }, (_, i) => ({ uid: `u${String(i).padStart(2, '0')}`, data: { displayName: `L${i}` } }));
const batch = {
  id: 'b14',
  groups: [
    { id: 'G1', name: 'Group 1', joinLink: 'https://zoom.us/j/111', links: { S1: 'https://zoom.us/j/1-day1' } },
    { id: 'G2', name: 'Group 2', joinLink: 'https://zoom.us/j/222' },
  ],
};
const inGroup = (id, batchId = 'b14') => ({ programAccess: { lep: { group: { batchId, id } } } });

describe('splitting a batch', () => {
  it('45 by 15 → three groups of 15', () => {
    const { groups, assign } = splitIntoGroups(learners(45), 15);
    expect(groups.map((g) => g.id)).toEqual(['G1', 'G2', 'G3']);
    const count = {};
    for (const g of assign.values()) count[g] = (count[g] || 0) + 1;
    expect(count).toEqual({ G1: 15, G2: 15, G3: 15 });
  });
  it('uneven numbers stay balanced (47 → 16/16/15)', () => {
    const { assign } = splitIntoGroups(learners(47), 15);
    const sizes = Object.values([...assign.values()].reduce((c, g) => ({ ...c, [g]: (c[g] || 0) + 1 }), {})).sort();
    expect(sizes).toEqual([15, 16, 16]);
  });
  it('a small batch is one group', () => {
    expect(splitIntoGroups(learners(9), 15).groups).toHaveLength(1);
  });
  it('re-splitting keeps the links CX already pasted', () => {
    expect(groupRows(3, batch.groups)[0].joinLink).toBe('https://zoom.us/j/111');
    expect(groupRows(3, batch.groups)[2]).toEqual({ id: 'G3', name: 'Group 3', joinLink: '', links: {} });
  });
});

describe('her link', () => {
  it("her group's link for every session; a session-only link wins for that session", () => {
    expect(groupJoinLink(batch, 'G1', 'S2')).toBe('https://zoom.us/j/111');
    expect(groupJoinLink(batch, 'G1', 'S1')).toBe('https://zoom.us/j/1-day1');
    expect(groupJoinLink(batch, 'G2', 'S1')).toBe('https://zoom.us/j/222');
  });
  it('no group (or a group from her old batch) → no group link', () => {
    expect(learnerGroupId(inGroup('G2'), batch)).toBe('G2');
    expect(learnerGroupId(inGroup('G2', 'old-batch'), batch)).toBe('');
    expect(learnerGroupId({}, batch)).toBe('');
    expect(groupJoinLink(batch, '', 'S1')).toBe('');
  });
});

describe('late joiners', () => {
  it('go into the smallest group', () => {
    const ls = [{ data: inGroup('G1') }, { data: inGroup('G1') }, { data: inGroup('G2') }];
    expect(smallestGroup(batch, ls)).toBe('G2');
    expect(smallestGroup({ id: 'x' }, ls)).toBe('');
  });
});
