/**
 * Keep CMS batches in step with Zoho without CX doing anything:
 *
 *  1. ensureLepCmsBatches — every LEP batch Zoho has (an LMS `groups` doc with learners, from
 *     the nightly sync or the batch webhook) belongs to a CMS batch of the same Day 1:
 *       - a CMS batch for that Day 1 exists → the new group is added to it (lmsGroupIds)
 *       - none exists → a CMS batch is created with the standard LEP schedule; it then
 *         switches its reminders on by itself (batchAutoStart.js)
 *  2. placeUngrouped — in a batch split into groups (Group 1, 2, 3 …), every learner who is
 *     not in one yet (joined later, or rescheduled in from another batch) goes into the
 *     smallest group, so the CMS counts and her Zoom link are right within minutes.
 */
const { lepDay1FromBatchText } = require('./lepBatchText');
const { buildLepBatchSessions, orientationFromDay1Saturday } = require('./lepScheduleShared');
const { batchGroupIds, learnersForBatch } = require('./cmsBatchLearners');
const { batchGroupsOf, learnerGroupId, smallestGroup } = require('./batchGroups');

const QA_BATCH_IDS = new Set(['lep-cms-qa-oct2026']);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

/** "21st Nov batch" — the CMS naming CX already use. */
function batchName(day1) {
  const [, m, d] = day1.split('-').map(Number);
  return `${ordinal(d)} ${MON[m - 1]} batch`;
}

/** Day 1 of an LMS group, from its Zoho batch text (either style) or its name. */
function groupDay1(group) {
  return lepDay1FromBatchText(group.zohoRawBatch) || lepDay1FromBatchText(String(group.name || '').replace(/^LEP\s*·\s*/i, ''));
}

/**
 * What to do for each unlinked LEP group. Pure, so it is tested without a database.
 * @returns {Array<{ groupId, day1, action: 'link'|'create', batchId? }>}
 */
function planLepLinks(groups, batches, todayIso) {
  const linked = new Set(batches.flatMap((b) => batchGroupIds(b)));
  const lep = batches.filter((b) => String(b.program || 'LEP').toUpperCase() === 'LEP' && !QA_BATCH_IDS.has(b.id));
  const plan = [];
  const createdFor = new Map();
  for (const g of groups) {
    if (linked.has(g.id) || !(g.memberCount > 0)) continue;
    const day1 = groupDay1(g);
    if (!day1) continue;
    // Upcoming or running batches only (a batch runs about 4 weeks after Day 1).
    const ends = new Date(`${day1}T12:00:00Z`);
    ends.setUTCDate(ends.getUTCDate() + 35);
    if (ends.toISOString().slice(0, 10) < todayIso) continue;
    const same = lep.filter((b) => String(b.day1Date || '').slice(0, 10) === day1);
    const target = same.find((b) => batchGroupIds(b).length) || same[0];
    if (target) plan.push({ groupId: g.id, day1, action: 'link', batchId: target.id });
    else if (createdFor.has(day1)) plan.push({ groupId: g.id, day1, action: 'link', batchId: createdFor.get(day1) });
    else {
      createdFor.set(day1, `new:${day1}`);
      plan.push({ groupId: g.id, day1, action: 'create', zohoBatchKey: g.zohoRawBatch || '' });
    }
  }
  return plan;
}

async function ensureLepCmsBatches(db, nowMs = Date.now()) {
  const today = new Date(nowMs + 330 * 60000).toISOString().slice(0, 10);
  const [gSnap, bSnap] = await Promise.all([
    db.collection('groups').where('program', '==', 'lep').get(),
    db.collection('cms_batches').get(),
  ]);
  const groups = gSnap.docs.map((d) => {
    const g = d.data() || {};
    return { id: d.id, name: g.name || '', zohoRawBatch: g.zohoRawBatch || '', memberCount: (g.memberIds || []).length };
  });
  const batches = bSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const plan = planLepLinks(groups, batches, today);
  const created = new Map();
  const done = [];
  for (const step of plan) {
    let batchId = step.batchId;
    if (step.action === 'create') {
      const ref = db.collection('cms_batches').doc();
      await ref.set({
        name: batchName(step.day1),
        program: 'LEP',
        day1Date: step.day1,
        orientationDate: orientationFromDay1Saturday(step.day1),
        timezone: 'Asia/Kolkata',
        sessions: buildLepBatchSessions({ anchor: 'day1', date: step.day1, joinLinks: {} }),
        lmsGroupId: step.groupId,
        lmsGroupIds: [],
        zohoBatchKey: step.zohoBatchKey,
        openForEnrollment: false,
        filling: false,
        status: 'draft',
        automationEnabled: false,
        notes: 'Created automatically from Zoho. Add Zoom links in Calendar.',
        createdAt: new Date(nowMs),
        updatedAt: new Date(nowMs),
      });
      created.set(step.day1, ref.id);
      done.push({ ...step, batchId: ref.id });
      continue;
    }
    if (String(batchId).startsWith('new:')) batchId = created.get(step.day1);
    if (!batchId) continue;
    const ref = db.collection('cms_batches').doc(batchId);
    const snap = await ref.get();
    const b = snap.data() || {};
    const patch = b.lmsGroupId
      ? { lmsGroupIds: [...new Set([...(b.lmsGroupIds || []), step.groupId])].filter((x) => x !== b.lmsGroupId) }
      : { lmsGroupId: step.groupId };
    await ref.set({ ...patch, updatedAt: new Date(nowMs) }, { merge: true });
    done.push({ ...step, batchId });
  }
  if (done.length) console.log('[batchSync] Zoho batches linked or created:', JSON.stringify(done));
  return done;
}

/** Put every learner of a grouped batch who is in no group into the smallest one. */
async function placeUngrouped(db, batch, learners) {
  if (!batchGroupsOf(batch).length) return 0;
  const list = learners || (await learnersForBatch(db, batch));
  let placed = 0;
  for (const l of list) {
    if (learnerGroupId(l.data, batch)) continue;
    const id = smallestGroup(batch, list);
    const group = { batchId: batch.id, id };
    l.data.programAccess = { ...(l.data.programAccess || {}), lep: { ...(l.data.programAccess?.lep || {}), group } };
    await db.collection('users').doc(l.uid).set({ programAccess: { lep: { group } } }, { merge: true });
    placed += 1;
  }
  return placed;
}

module.exports = { ensureLepCmsBatches, placeUngrouped, planLepLinks, groupDay1, batchName };
