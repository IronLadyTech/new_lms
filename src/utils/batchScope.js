/** Batch scoping for Customer Expression (moderator) dashboards. */

import { PROGRAMS } from '../data/programTypes';

export function filterBatchesForModerator(groups, moderatorUid) {
  if (!moderatorUid || !groups?.length) return [];
  return groups.filter((g) => (g.moderatorIds || []).includes(moderatorUid));
}

export function isStudentRole(user) {
  return !user?.role || user.role === 'student';
}

/** MBW cohort on profile (Zoho) — includes legacy users with no program field on MBW CX. */
export function isProgramLearner(user, program = PROGRAMS.MBW) {
  if (!user || !isStudentRole(user)) return false;
  if (!program) return true;
  return user.program === program || (!user.program && program === PROGRAMS.MBW);
}

export function memberIdsForBatches(batches, users = []) {
  const ids = new Set();
  (batches || []).forEach((b) => {
    (b.memberIds || []).forEach((id) => ids.add(id));
    (users || []).forEach((u) => {
      if (u.batchId === b.id) ids.add(u.id);
    });
  });
  return [...ids];
}

/** Learner ids explicitly assigned to one batch. */
export function learnerIdsInBatch(batch, users = []) {
  const ids = new Set(batch?.memberIds || []);
  (users || []).forEach((u) => {
    if (u.batchId === batch?.id) ids.add(u.id);
  });
  return ids;
}

export function studentsInBatch(batch, users = []) {
  const ids = learnerIdsInBatch(batch, users);
  return (users || []).filter((u) => ids.has(u.id) && isStudentRole(u));
}

export function batchOptionsFromGroups(batches) {
  return (batches || []).map((b) => ({
    id: b.id,
    name: b.name,
    program: b.program || 'mbw',
    memberCount: (b.memberIds || []).length,
  }));
}

export function userInBatch(user, batchId) {
  if (!batchId || !user) return false;
  return user.batchId === batchId;
}

/**
 * CX / admin learner lists.
 * - batchFilterId === 'all': batch members + unassigned learners on this program (Zoho cohort)
 * - batchFilterId === id: only that batch's assigned members
 */
export function filterStudentsForBatches(users, batches, batchFilterId = 'all', { program } = {}) {
  const memberIds = new Set(memberIdsForBatches(batches, users));
  const batchIds = new Set((batches || []).map((b) => b.id));

  return (users || []).filter((u) => {
    if (!isStudentRole(u)) return false;

    const inMembers = memberIds.has(u.id);
    const inProfile = u.batchId && batchIds.has(u.batchId);
    const inProgramCohort = isProgramLearner(u, program);

    if (batchFilterId !== 'all') {
      const batch = batches.find((b) => b.id === batchFilterId);
      if (batch?.memberIds?.includes(u.id)) return true;
      return u.batchId === batchFilterId;
    }

    return inMembers || inProfile || inProgramCohort;
  });
}

export function countBatchAssignedLearners(students, batches, users = []) {
  const assignedIds = new Set(memberIdsForBatches(batches, users));
  return (students || []).filter((s) => assignedIds.has(s.id)).length;
}
