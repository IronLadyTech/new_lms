/**
 * CMS batch helpers on the server — real LMS batches per program, and learner counts.
 * Numbers and batch names only, never learner names or phone numbers: CX (CEM)
 * cannot read learner profiles or LMS batch docs under Firestore rules.
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
 * Learners of a cms_batches doc. The Zoho batch sync records membership on the LMS
 * batch (groups/{id}.memberIds) and users.batchId; learners who chose a batch in the
 * app carry programAccess.<program>.batchId. Either link counts.
 */
async function learnersForBatch(db, batch) {
  const groupId = String(batch?.lmsGroupId || '').trim();
  if (!groupId) return [];
  const key = accessKey(batch.program);

  const uids = new Set();
  const group = await db.collection('groups').doc(groupId).get();
  (group.data()?.memberIds || []).forEach((id) => id && uids.add(String(id)));
  const chosen = await db
    .collection('users')
    .where(`programAccess.${key}.batchId`, '==', groupId)
    .limit(1000)
    .get();
  chosen.docs.forEach((d) => uids.add(d.id));

  const ids = [...uids];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db.collection('users').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => s.exists && out.push({ uid: s.id, data: s.data() || {} }));
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

  if (!batch.lmsGroupId)
    return { linked: false, counts: { all: 0, register: 0, paid: 0, late: 0, unknown: 0 } };
  const learners = await learnersForBatch(db, batch);
  return {
    linked: true,
    counts: countSegments(
      learners.map((l) => l.data),
      batch
    ),
  };
}

/** Real batches for one program, from the LMS (synced from Zoho): name, raw Zoho value, size. */
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

module.exports = { runCmsBatchLearnerCounts, runCmsListProgramBatches, learnersForBatch };
