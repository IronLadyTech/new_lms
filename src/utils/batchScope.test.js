import { describe, it, expect } from 'vitest';
import {
  filterBatchesForModerator,
  isProgramLearner,
  isStudentRole,
  learnerIdsInBatch,
  studentsInBatch,
  memberIdsForBatches,
  filterStudentsForBatches,
  countBatchAssignedLearners,
} from './batchScope';
import { PROGRAMS } from '../data/programTypes';

/**
 * These functions decide which learners a CX moderator can see. Getting them
 * wrong exposes one cohort's learners to another cohort's staff, so the tests
 * lean on the negative cases.
 */

const learner = (id, extra = {}) => ({ id, role: 'student', ...extra });

describe('filterBatchesForModerator', () => {
  const batches = [
    { id: 'b1', moderatorIds: ['mod-a'] },
    { id: 'b2', moderatorIds: ['mod-b'] },
    { id: 'b3', moderatorIds: ['mod-a', 'mod-b'] },
    { id: 'b4' },
  ];

  it('returns only batches the moderator is assigned to', () => {
    expect(filterBatchesForModerator(batches, 'mod-a').map((b) => b.id)).toEqual(['b1', 'b3']);
  });

  it('returns nothing without a moderator id — never falls open', () => {
    expect(filterBatchesForModerator(batches, null)).toEqual([]);
    expect(filterBatchesForModerator(batches, undefined)).toEqual([]);
    expect(filterBatchesForModerator(batches, '')).toEqual([]);
  });

  it('excludes batches with no moderators assigned', () => {
    const ids = filterBatchesForModerator(batches, 'mod-a').map((b) => b.id);
    expect(ids).not.toContain('b4');
  });
});

describe('isStudentRole', () => {
  it('treats a missing role as a learner — legacy profiles predate the field', () => {
    expect(isStudentRole({ id: 'u1' })).toBe(true);
    expect(isStudentRole(learner('u1'))).toBe(true);
  });

  it('excludes staff roles', () => {
    expect(isStudentRole({ role: 'moderator' })).toBe(false);
    expect(isStudentRole({ role: 'admin' })).toBe(false);
    expect(isStudentRole({ role: 'superadmin' })).toBe(false);
  });
});

describe('isProgramLearner', () => {
  it('matches a learner on the requested programme', () => {
    expect(isProgramLearner(learner('u1', { program: PROGRAMS.BM100 }), PROGRAMS.BM100)).toBe(true);
  });

  it('does not leak a learner from another programme', () => {
    expect(isProgramLearner(learner('u1', { program: PROGRAMS.BM100 }), PROGRAMS.MBW)).toBe(false);
  });

  it('treats a learner with no programme as MBW only', () => {
    const legacy = learner('u1');
    expect(isProgramLearner(legacy, PROGRAMS.MBW)).toBe(true);
    expect(isProgramLearner(legacy, PROGRAMS.BM100)).toBe(false);
  });

  it('never counts staff as programme learners', () => {
    expect(isProgramLearner({ id: 's1', role: 'admin', program: PROGRAMS.MBW }, PROGRAMS.MBW)).toBe(
      false
    );
  });
});

describe('learnerIdsInBatch / studentsInBatch', () => {
  const batch = { id: 'b1', memberIds: ['u1'] };
  const users = [learner('u1'), learner('u2', { batchId: 'b1' }), learner('u3')];

  it('combines explicit membership with profile batchId', () => {
    expect([...learnerIdsInBatch(batch, users)].sort()).toEqual(['u1', 'u2']);
  });

  it('excludes learners in neither list', () => {
    expect([...learnerIdsInBatch(batch, users)]).not.toContain('u3');
  });

  it('filters staff out of the member list', () => {
    const withStaff = [...users, { id: 'mod', role: 'moderator', batchId: 'b1' }];
    expect(
      studentsInBatch(batch, withStaff)
        .map((u) => u.id)
        .sort()
    ).toEqual(['u1', 'u2']);
  });

  it('handles a missing batch without throwing', () => {
    expect([...learnerIdsInBatch(undefined, users)]).toEqual([]);
  });
});

describe('memberIdsForBatches', () => {
  it('deduplicates a learner listed in a batch and pointing at it', () => {
    const batches = [{ id: 'b1', memberIds: ['u1'] }];
    const users = [learner('u1', { batchId: 'b1' })];
    expect(memberIdsForBatches(batches, users)).toEqual(['u1']);
  });

  it('returns nothing for no batches', () => {
    expect(memberIdsForBatches([], [learner('u1')])).toEqual([]);
  });
});

describe('filterStudentsForBatches', () => {
  const batches = [
    { id: 'b1', memberIds: ['u1'] },
    { id: 'b2', memberIds: ['u2'] },
  ];
  const users = [
    learner('u1', { program: PROGRAMS.MBW }),
    learner('u2', { program: PROGRAMS.MBW }),
    learner('u3', { program: PROGRAMS.MBW }), // unassigned, same programme
    learner('u4', { program: PROGRAMS.BM100 }), // other programme
    { id: 'mod', role: 'moderator', program: PROGRAMS.MBW },
  ];

  it('scopes to a single batch when one is selected', () => {
    const ids = filterStudentsForBatches(users, batches, 'b1').map((u) => u.id);
    expect(ids).toEqual(['u1']);
  });

  it('includes unassigned learners of the same programme under "all"', () => {
    const ids = filterStudentsForBatches(users, batches, 'all', { program: PROGRAMS.MBW })
      .map((u) => u.id)
      .sort();
    expect(ids).toEqual(['u1', 'u2', 'u3']);
  });

  it('excludes learners from another programme', () => {
    const ids = filterStudentsForBatches(users, batches, 'all', { program: PROGRAMS.MBW }).map(
      (u) => u.id
    );
    expect(ids).not.toContain('u4');
  });

  it('never includes staff accounts', () => {
    const ids = filterStudentsForBatches(users, batches, 'all', { program: PROGRAMS.MBW }).map(
      (u) => u.id
    );
    expect(ids).not.toContain('mod');
  });

  it('returns nothing when a selected batch does not exist', () => {
    expect(filterStudentsForBatches(users, batches, 'missing-batch')).toEqual([]);
  });
});

describe('countBatchAssignedLearners', () => {
  it('counts only learners actually assigned to a batch', () => {
    const batches = [{ id: 'b1', memberIds: ['u1'] }];
    const users = [learner('u1'), learner('u2')];
    expect(countBatchAssignedLearners(users, batches, users)).toBe(1);
  });

  it('is zero when there are no batches', () => {
    expect(countBatchAssignedLearners([learner('u1')], [], [])).toBe(0);
  });
});
