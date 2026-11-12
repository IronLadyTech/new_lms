/**
 * CMS batch helpers on the server — real LMS batches per program, and learner counts.
 * CX (CEM) cannot read learner profiles under Firestore rules, so what they need comes from
 * here: counts, and for groups, names with only the last 4 digits of the mobile.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { accessKey, countSegments } = require('./learnerSegments');

const CMS_STAFF = ['admin', 'superadmin', 'pl', 'cem', 'moderator'];
const PROGRAMS = new Set(['lep', '100bm', 'mbw']);

async function assertCmsStaff(db, uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  const me = await db.collection('users').doc(uid).get();
  if (!CMS_STAFF.includes(me.data()?.role))
    throw new HttpsError('permission-denied', 'Staff CMS access required');
}

/**
 * Every LMS batch (group) a cms_batches doc covers. Zoho sync makes more than one group for
 * the same dates ("24/10/2026 - 24/11/2026" and "24 Oct 2026 – 24 Nov 2026"); the cohort is
 * usually in one and a few learners in the other, so a batch lists all of them in
 * lmsGroupIds. lmsGroupId (the main one) is always included.
 */
function batchGroupIds(batch) {
  const ids = [batch?.lmsGroupId, ...(Array.isArray(batch?.lmsGroupIds) ? batch.lmsGroupIds : [])]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

function isoDay(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** Her own LEP Day 1 — set by Zoho (LEP_Reg_Date) or when she changes batch in the app. */
function ownLepDay1(profile) {
  return isoDay(profile?.programAccess?.lep?.day1Date);
}

/**
 * Is this the only linked CMS batch with this Day 1? Then learners are matched to it by
 * date as well. Two linked batches on one date (e.g. the CMS QA test batch) never are,
 * so a test batch can never pull in a real cohort.
 */
async function ownsDay1(db, batch, day1) {
  const snap = await db.collection('cms_batches').where('day1Date', '==', day1).get();
  return !snap.docs.some((d) => d.id !== batch.id && batchGroupIds(d.data()).length);
}

/**
 * Learners of a cms_batches doc. The Zoho batch sync records membership on the LMS
 * batch (groups/{id}.memberIds) and users.batchId; learners who chose a batch in the
 * app carry programAccess.<program>.batchId. Either link counts.
 *
 * LEP: her own Day 1 decides. When she reschedules (CX in Zoho, or in the app), her
 * programAccess.lep.day1Date changes at once, while the group membership waits for the
 * Zoho batch sync. So a learner whose own Day 1 is another date has moved and is left
 * out, and a learner whose own Day 1 is this batch's is in, whichever group she is in.
 * Without a Day 1 of her own, the group decides as before.
 */
async function learnersForBatch(db, batch) {
  const groupIds = batchGroupIds(batch);
  if (!groupIds.length) return [];
  const key = accessKey(batch.program);
  const isLep = key === 'lep';
  const day1 = isLep ? isoDay(batch.day1Date) : '';

  const uids = new Set();
  for (const groupId of groupIds) {
    const group = await db.collection('groups').doc(groupId).get();
    (group.data()?.memberIds || []).forEach((id) => id && uids.add(String(id)));
    const chosen = await db
      .collection('users')
      .where(`programAccess.${key}.batchId`, '==', groupId)
      .limit(1000)
      .get();
    chosen.docs.forEach((d) => uids.add(d.id));
  }
  if (day1 && (await ownsDay1(db, batch, day1))) {
    const moved = await db
      .collection('users')
      .where('programAccess.lep.day1Date', '==', day1)
      .limit(1000)
      .get();
    moved.docs.forEach((d) => uids.add(d.id));
  }

  const ids = [...uids];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db.collection('users').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => {
      if (!s.exists) return;
      const data = s.data() || {};
      const own = day1 ? ownLepDay1(data) : '';
      if (own && own !== day1) return; // rescheduled to another batch
      out.push({ uid: s.id, data });
    });
  }
  return out;
}

async function runCmsBatchLearnerCounts(db, request) {
  await assertCmsStaff(db, request.auth?.uid);
  const batchId = String(request.data?.batchId || '').trim();
  if (!batchId) throw new HttpsError('invalid-argument', 'batchId is required');
  const snap = await db.collection('cms_batches').doc(batchId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such batch');
  const batch = { id: snap.id, ...snap.data() };

  if (!batchGroupIds(batch).length)
    return { linked: false, counts: { all: 0, register: 0, paid: 0, late: 0, unknown: 0 } };
  const learners = await learnersForBatch(db, batch);
  return {
    linked: true,
    counts: countSegments(
      learners.map((l) => l.data),
      batch
    ),
    groupCounts: groupCounts(batch, learners),
    roster: groupRoster(batch, learners),
  };
}

/** Learners per group, how many are in none yet, and how many the split left out (not in Zoho). */
function groupCounts(batch, learners) {
  const { batchGroupsOf, learnerGroupId } = require('./batchGroups');
  const groups = batchGroupsOf(batch);
  if (!groups.length) return null;
  const left = new Set(batch.groupsLeftOut || []);
  const out = Object.fromEntries(groups.map((g) => [g.id, 0]));
  out.none = 0;
  out.leftOut = 0;
  for (const l of learners) {
    const id = learnerGroupId(l.data, batch);
    if (id) out[id] += 1;
    else if (left.has(l.uid)) out.leftOut += 1;
    else out.none += 1;
  }
  return out;
}

/**
 * Who is in which group, for the CEM team (CMS staff only): name and the last 4 digits of
 * her mobile, per group, then "not placed yet" and "left out (not in Zoho)".
 */
function groupRoster(batch, learners) {
  const { batchGroupsOf, learnerGroupId } = require('./batchGroups');
  const groups = batchGroupsOf(batch);
  if (!groups.length) return null;
  const left = new Set(batch.groupsLeftOut || []);
  const rows = learners
    .map((l) => {
      const d = l.data || {};
      const gid = learnerGroupId(d, batch);
      return {
        name: String(d.displayName || d.name || d.email || 'Learner').trim(),
        phone: String(d.phoneNumber || d.phone || '').replace(/\D/g, '').slice(-4),
        group: gid || (left.has(l.uid) ? 'leftOut' : 'none'),
      };
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return rows;
}

/**
 * CMS "Split into groups": the batch's learners into groups of about `size` (default 15),
 * evenly, for every session. Keeps links CX already pasted.
 *
 * LEP: Zoho decides who is in the batch, so a stale or test change made only in the app can
 * never take a seat. Zoho is read first (same match as "Check against Zoho"):
 *  - learners Zoho lists for this Day 1 are grouped, and their app copy of the batch is
 *    brought in line with Zoho (Day 1 and the batch text) on the way;
 *  - learners the app has here but Zoho does not are left out, by name, with the reason.
 *    They keep the batch's main link, and are not placed later by the scheduler either
 *    (groupsLeftOut) until a new split finds them in Zoho.
 * If Zoho cannot be read, nothing is split.
 */
async function runCmsSplitBatchGroups(db, request, deps) {
  await assertCmsStaff(db, request.auth?.uid);
  const batchId = String(request.data?.batchId || '').trim();
  if (!batchId) throw new HttpsError('invalid-argument', 'batchId is required');
  const ref = db.collection('cms_batches').doc(batchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such batch');
  const batch = { id: snap.id, ...snap.data() };
  if (!batchGroupIds(batch).length)
    throw new HttpsError('failed-precondition', 'Link this batch to its learners first.');

  const { splitIntoGroups } = require('./batchGroups');
  const all = await learnersForBatch(db, batch);
  if (!all.length) throw new HttpsError('failed-precondition', 'This batch has no learners yet.');

  const day1 = isoDay(batch.day1Date);
  const zohoCheck = accessKey(batch.program) === 'lep' && day1 && deps;
  let learners = all;
  let leftOut = [];
  let matched = new Map();
  let zohoOnly = [];
  if (zohoCheck) {
    const { matchRoster, fetchZohoBatchLeads } = require('./zohoBatchCheck');
    let leads;
    try {
      leads = await fetchZohoBatchLeads(day1, deps);
    } catch (e) {
      throw new HttpsError('unavailable', 'Zoho could not be read, so nothing was split. Try again in a minute.');
    }
    const roster = matchRoster(leads, all);
    matched = roster.matched;
    zohoOnly = roster.unmatchedLeads.map((l) => l.Full_Name || l.Email || 'Unnamed lead');
    learners = all.filter((l) => matched.has(l.uid));
    leftOut = all.filter((l) => !matched.has(l.uid));
    if (!learners.length)
      throw new HttpsError('failed-precondition', 'Zoho has none of this batch’s learners on this Day 1, so nothing was split.');
  }

  const { groups, assign } = splitIntoGroups(learners, request.data?.size, batch.groups || []);
  await ref.set(
    { groups, groupsSplitAt: new Date(), groupsLeftOut: leftOut.map((l) => l.uid), updatedAt: new Date() },
    { merge: true }
  );

  const writes = [];
  let synced = 0;
  for (const l of learners) {
    const lep = { group: { batchId, id: assign.get(l.uid) } };
    const lead = matched.get(l.uid);
    if (lead) {
      const own = l.data?.programAccess?.lep || {};
      if (isoDay(own.day1Date) !== day1) lep.day1Date = day1;
      if (lead.LEP_Batch && own.zohoRawBatch !== lead.LEP_Batch) lep.zohoRawBatch = lead.LEP_Batch;
      if (lep.day1Date || lep.zohoRawBatch) synced += 1;
    }
    writes.push([l.uid, { programAccess: { lep } }]);
  }
  for (const l of leftOut) {
    if (l.data?.programAccess?.lep?.group?.batchId === batchId)
      writes.push([l.uid, { programAccess: { lep: { group: null } } }]);
  }
  for (let i = 0; i < writes.length; i += 400) {
    const w = db.batch();
    for (const [uid, patch] of writes.slice(i, i + 400)) w.set(db.collection('users').doc(uid), patch, { merge: true });
    await w.commit();
  }

  const sizes = Object.fromEntries(groups.map((g) => [g.id, 0]));
  for (const id of assign.values()) sizes[id] += 1;
  const nameOf = (d) => d?.displayName || d?.name || d?.email || 'Learner';
  return {
    ok: true,
    zohoChecked: Boolean(zohoCheck),
    groups: groups.map((g) => ({ id: g.id, name: g.name, learners: sizes[g.id] })),
    synced,
    leftOut: leftOut.map((l) => {
      const zb = l.data?.programAccess?.lep?.zohoRawBatch;
      return {
        name: nameOf(l.data),
        why: zb
          ? `Not in Zoho for this date (her Zoho batch reads "${zb}"). Not put in a group.`
          : 'Not in Zoho for this date. Not put in a group. If she belongs here, fix her LEP Batch in Zoho and split again.',
      };
    }),
    zohoOnly: zohoOnly.slice(0, 100),
  };
}

async function runCmsListProgramBatches(db, request) {
  await assertCmsStaff(db, request.auth?.uid);
  const program = String(request.data?.program || '').toLowerCase();
  if (!PROGRAMS.has(program))
    throw new HttpsError('invalid-argument', 'program must be lep, 100bm or mbw');

  const snap = await db.collection('groups').where('program', '==', program).get();
  const batches = snap.docs.map((d) => {
    const g = d.data() || {};
    return {
      id: d.id,
      name: g.name || d.id,
      program,
      zohoRawBatch: g.zohoRawBatch || '',
      memberCount: Array.isArray(g.memberIds) ? g.memberIds.length : 0,
    };
  });
  return { batches };
}

/**
 * CMS "Check against Zoho": the batch's learners in the app vs Zoho's Leads for its Day 1.
 * Counts, and the names that differ with the reason (zohoBatchCheck.js). Names are shown to
 * CMS staff only, so CEM can fix them in Zoho.
 */
async function runCmsBatchZohoCheck(db, request, deps) {
  await assertCmsStaff(db, request.auth?.uid);
  const batchId = String(request.data?.batchId || '').trim();
  if (!batchId) throw new HttpsError('invalid-argument', 'batchId is required');
  const snap = await db.collection('cms_batches').doc(batchId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such batch');
  const batch = { id: snap.id, ...snap.data() };
  const day1 = String(batch.day1Date || '').slice(0, 10);
  if (!day1) throw new HttpsError('failed-precondition', 'Set this batch’s Day 1 first.');

  const { compareRoster, fetchZohoBatchLeads } = require('./zohoBatchCheck');
  const [leads, learners] = await Promise.all([fetchZohoBatchLeads(day1, deps), learnersForBatch(db, batch)]);
  // Zoho names the app does not have here: is there an account, and on which batch?
  const first = compareRoster(leads, learners, { day1 });
  const elsewhere = {};
  const missingEmails = leads
    .filter((l) => first.onlyZoho.some((x) => x.name === (l.Full_Name || l.Email || 'Unnamed lead')))
    .map((l) => String(l.Email || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 60);
  for (const email of missingEmails) {
    const u = await db.collection('users').where('email', '==', email).limit(1).get();
    elsewhere[email] = u.empty ? null : String(u.docs[0].data()?.programAccess?.lep?.day1Date || '').slice(0, 10);
  }
  return { ok: true, day1, checkedAt: new Date().toISOString(), ...compareRoster(leads, learners, { day1, elsewhere }) };
}

module.exports = {
  assertCmsStaff,
  runCmsBatchZohoCheck,
  runCmsBatchLearnerCounts,
  runCmsListProgramBatches,
  runCmsSplitBatchGroups,
  learnersForBatch,
  batchGroupIds,
  ownLepDay1,
};
