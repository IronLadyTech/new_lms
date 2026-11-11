/**
 * Groups inside one batch: a 45-learner batch runs as Group 1, 2, 3 of 15, each with its own
 * Zoom room — for every session, Orientation and the full days included.
 *
 * cms_batches/{id}.groups = [{ id: 'G1', name: 'Group 1', joinLink: '<one link for every
 *   session>', links: { S1: '<this session only>' } }]
 * users/{uid}.programAccess.lep.group = { batchId, id }   — her group in that batch
 *
 * CX split the batch once in the CMS (splitIntoGroups) and paste one link per group. A learner
 * who joins later is put in the smallest group the first time a reminder needs her link.
 */

function batchGroupsOf(batch) {
  return Array.isArray(batch?.groups) ? batch.groups.filter((g) => g && g.id) : [];
}

/** Her group id in this batch, or '' (a group from another batch does not count). */
function learnerGroupId(data, batch) {
  const g = data?.programAccess?.lep?.group;
  if (!g || !g.id || String(g.batchId || '') !== String(batch?.id || '')) return '';
  return batchGroupsOf(batch).some((x) => x.id === g.id) ? g.id : '';
}

/** The link for her group and this session: a session-only link, else the group's link, else ''. */
function groupJoinLink(batch, groupId, sessionCode) {
  const g = batchGroupsOf(batch).find((x) => x.id === groupId);
  if (!g) return '';
  const own = g.links && sessionCode ? String(g.links[sessionCode] || '').trim() : '';
  return own || String(g.joinLink || '').trim();
}

/** Group rows for n groups, keeping names and links of groups that already exist. */
function groupRows(n, existing = []) {
  const byId = new Map(existing.map((g) => [g.id, g]));
  return Array.from({ length: n }, (_, i) => {
    const id = `G${i + 1}`;
    const prev = byId.get(id) || {};
    return { id, name: prev.name || `Group ${i + 1}`, joinLink: prev.joinLink || '', links: prev.links || {} };
  });
}

/**
 * Split learners into groups of about `size`, as evenly as possible (45 by 15 → 15/15/15,
 * 47 by 15 → 16/16/15). Order is stable: by name, then id, so a re-split is predictable.
 * @returns {{ groups, assign: Map<uid, groupId> }}
 */
function splitIntoGroups(learners, size, existing = []) {
  const per = Math.max(2, Math.floor(Number(size) || 15));
  const n = Math.max(1, Math.round(learners.length / per) || 1);
  const groups = groupRows(n, existing);
  const sorted = [...learners].sort((a, b) => {
    const an = String(a.data?.displayName || a.data?.name || '').toLowerCase();
    const bn = String(b.data?.displayName || b.data?.name || '').toLowerCase();
    return an.localeCompare(bn) || String(a.uid).localeCompare(String(b.uid));
  });
  const assign = new Map();
  sorted.forEach((l, i) => assign.set(l.uid, groups[i % n].id));
  return { groups, assign };
}

/** The group with the fewest learners (first on a tie), for a late joiner. */
function smallestGroup(batch, learners) {
  const groups = batchGroupsOf(batch);
  if (!groups.length) return '';
  const size = Object.fromEntries(groups.map((g) => [g.id, 0]));
  for (const l of learners) {
    const id = learnerGroupId(l.data, batch);
    if (id) size[id] += 1;
  }
  return groups.reduce((best, g) => (size[g.id] < size[best] ? g.id : best), groups[0].id);
}

module.exports = { batchGroupsOf, learnerGroupId, groupJoinLink, groupRows, splitIntoGroups, smallestGroup };
