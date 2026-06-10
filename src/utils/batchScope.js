/** Batch scoping for Customer Expression (moderator) dashboards. */

export function filterBatchesForModerator(groups, moderatorUid) {
  if (!moderatorUid || !groups?.length) return [];
  return groups.filter((g) => (g.moderatorIds || []).includes(moderatorUid));
}

export function memberIdsForBatches(batches) {
  const ids = new Set();
  (batches || []).forEach((b) => (b.memberIds || []).forEach((id) => ids.add(id)));
  return [...ids];
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

export function filterStudentsForBatches(users, batches, batchFilterId = 'all') {
  const memberIds = new Set(memberIdsForBatches(batches));
  const batchIds = new Set((batches || []).map((b) => b.id));

  return (users || []).filter((u) => {
    if (u.role && u.role !== 'student' && u.role !== '') return false;
    const inMembers = memberIds.has(u.id);
    const inProfile = u.batchId && batchIds.has(u.batchId);
    if (!inMembers && !inProfile) return false;
    if (batchFilterId !== 'all') {
      const batch = batches.find((b) => b.id === batchFilterId);
      if (batch?.memberIds?.includes(u.id)) return true;
      return u.batchId === batchFilterId;
    }
    return true;
  });
}
