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

module.exports = { runCmsBatchLearnerCounts, runCmsListProgramBatches, learnersForBatch, batchGroupIds, ownLepDay1 };
