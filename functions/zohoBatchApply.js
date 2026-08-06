/**
 * Zoho → LMS batch APPLY (writes Firestore groups + user batch links).
 *
 * Companion to zohoBatchSync.js (preview/dry-run). Supports bulk cohort apply,
 * per-user sync (admin callable + Zoho webhook), and post-provision sync.
 * Zoho remains read-only — no CRM writes from this module.
 */

const admin = require('firebase-admin');
const { readLeadStatusFromLead } = require('./zohoFieldMap');
const {
  splitList,
  batchDocId,
  batchDisplayName,
  classifyBatchValue,
  resolvePairing,
  buildPlan,
  fetchMergedBatchRecords,
} = require('./zohoBatchSync');
const {
  resolveLeadCohortFromLead,
  resolveLeadProgramId,
  fetchLeadsCohortMembers,
} = require('./zohoLeadsCohort');
const { mergeBatchSources, registrationToBatchRecord } = require('./zohoIlRegistration');

const BATCH_SYNC_RUNS = 'batch_sync_runs';
const GROUPS = 'groups';

/** Lead statuses that should not be added to a live cohort batch. */
const EXCLUDED_LEAD_STATUS = /\b(leave|left|drop|dropped|cancel|cancelled|refund|inactive)\b/i;

const MAX_BATCH_SIZE = 250;
const DEFAULT_CONCURRENCY = 4;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isActiveLeadStatus(statusRaw) {
  const status = String(statusRaw || '').trim();
  if (!status) return true;
  return !EXCLUDED_LEAD_STATUS.test(status);
}

async function fetchBatchRecords({ maxPages = 50, perPage = 200 } = {}, deps) {
  return fetchMergedBatchRecords({ maxPages, perPage }, deps);
}

/** Collect IL_Users rows mapped to a specific program + raw batch value. */
function collectBatchMembers(records, programId, rawBatch) {
  const target = String(rawBatch || '').trim();
  const byEmail = new Map();

  records.forEach((record) => {
    const pairing = resolvePairing(record);
    if (pairing.status !== 'ok') return;

    pairing.pairs.forEach(({ programId: pid, rawBatch: rb }) => {
      if (pid !== programId || String(rb || '').trim() !== target) return;
      const email = normalizeEmail(record.Email);
      if (!email) return;
      byEmail.set(email, record);
    });
  });

  return [...byEmail.entries()].map(([email, record]) => ({ email, record }));
}

async function findUserUidByEmail(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const snap = await db.collection('users').where('email', '==', normalized).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;

  const snapOriginal = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snapOriginal.empty) return snapOriginal.docs[0].id;

  try {
    const authUser = await admin.auth().getUserByEmail(normalized);
    return authUser.uid;
  } catch {
    return null;
  }
}

async function ensureBatchGroup(db, { docId, displayName, program, rawBatch, triggeredBy }) {
  const ref = db.collection(GROUPS).doc(docId);
  const existing = await ref.get();
  const now = new Date();

  const payload = {
    name: displayName,
    description: `Synced from Zoho · ${rawBatch}`,
    program,
    zohoRawBatch: rawBatch,
    zohoSyncedAt: now,
    updatedAt: now,
  };

  if (!existing.exists) {
    payload.courseIds = [];
    payload.memberIds = [];
    payload.moderatorIds = [];
    payload.createdBy = triggeredBy || null;
    payload.createdAt = now;
  }

  await ref.set(payload, { merge: true });
  return { id: docId, ...payload, existed: existing.exists };
}

async function assignMemberToBatch(db, { groupId, groupName, program, uid }) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const oldBatchId = userSnap.exists ? userSnap.data()?.batchId : null;

  if (oldBatchId && oldBatchId !== groupId) {
    await db.collection(GROUPS).doc(oldBatchId).update({
      memberIds: admin.firestore.FieldValue.arrayRemove(uid),
      updatedAt: new Date(),
    });
  }

  await db.collection(GROUPS).doc(groupId).update({
    memberIds: admin.firestore.FieldValue.arrayUnion(uid),
    updatedAt: new Date(),
  });

  await userRef.set(
    {
      batchId: groupId,
      batchName: groupName,
      program,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

async function mapPool(items, concurrency, worker) {
  const results = [];
  let next = 0;

  async function runWorker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runWorker())
  );
  return results;
}

/**
 * Apply one Zoho cohort to Firestore.
 *
 * Prefer Leads cohort (program + start/end dates) — matches Zoho CRM filters.
 * Fallback: IL_Users / IL_Registration batch string (rawBatch).
 */
async function applyBatchSync(
  {
    program,
    rawBatch,
    startDate,
    endDate,
    dryRun = true,
    maxPages = 50,
    triggeredBy = null,
    concurrency = DEFAULT_CONCURRENCY,
  },
  deps
) {
  const programId = String(program || '').trim().toLowerCase();

  if (!programId || !['lep', '100bm', 'mbw'].includes(programId)) {
    return { ok: false, reason: 'program must be lep, 100bm, or mbw' };
  }

  const useLeadsCohort = Boolean(startDate && endDate);

  if (!useLeadsCohort && !String(rawBatch || '').trim()) {
    return {
      ok: false,
      reason: 'Provide startDate + endDate (Leads cohort) or rawBatch (IL_Users)',
    };
  }

  let docId;
  let displayName;
  let batchValue;
  let members;
  let fetchMeta = {};

  if (useLeadsCohort) {
    const cohort = await fetchLeadsCohortMembers(
      { programId, startDate, endDate, maxPages },
      deps
    );
    if (!cohort.ok) return cohort;

    docId = cohort.docId;
    displayName = cohort.displayName;
    batchValue = `${startDate} – ${endDate}`;
    fetchMeta = {
      source: 'leads',
      scannedLeads: cohort.scannedLeads,
      truncated: cohort.truncated,
      query: cohort.query,
      fieldsUsed: cohort.fieldsUsed,
      method: cohort.method,
      skippedNoEmail: cohort.skippedNoEmail || 0,
      skippedDateMismatch: cohort.skippedDateMismatch || 0,
      duplicateEmails: cohort.duplicateEmails || 0,
      duplicateSamples: cohort.duplicateSamples || [],
      sampleDates: cohort.sampleDates || [],
      learners: cohort.learners || [],
      reason: cohort.reason,
    };
    members = cohort.members.map((m) => ({
      email: m.email,
      record: { ...m.lead, _source: 'leads', _status: m.leadStatus },
      leadStatus: m.leadStatus,
    }));
  } else {
    batchValue = String(rawBatch).trim();
    const batchInfo = classifyBatchValue(batchValue);
    if (!batchInfo.ok) {
      return { ok: false, reason: `Invalid batch value: ${batchInfo.reason}` };
    }

    const fetchResult = await fetchBatchRecords({ maxPages }, deps);
    const plan = buildPlan(fetchResult.rows);
    docId = batchDocId(programId, batchValue);
    displayName = batchDisplayName(programId, batchInfo);
    const planned = plan.plannedBatches.find((b) => b.docId === docId);

    if (!planned) {
      return {
        ok: false,
        reason: `No Zoho records resolve to ${programId} · ${batchValue}. Try Leads dates instead.`,
        method: fetchResult.method,
        sources: fetchResult.sources,
      };
    }

    fetchMeta = {
      source: 'il_users',
      method: fetchResult.method,
      registrationMethod: fetchResult.registrationMethod,
      sources: fetchResult.sources,
      truncated: fetchResult.truncated,
    };
    members = collectBatchMembers(fetchResult.rows, programId, batchValue).map((m) => ({
      ...m,
      leadStatus: null,
    }));
  }

  if (members.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      reason: `Batch has ${members.length} members — exceeds safety limit of ${MAX_BATCH_SIZE}`,
    };
  }

  const stats = {
    zohoMatched: members.length,
    active: 0,
    excludedByStatus: 0,
    provisioned: 0,
    assigned: 0,
    alreadyInBatch: 0,
    skipped: 0,
    errors: [],
  };

  const activeMembers = [];

  for (const member of members) {
    let leadStatus = member.leadStatus || member.record._status || '';
    if (!leadStatus && deps.getLeadByEmail) {
      try {
        const lead = await deps.getLeadByEmail(member.email);
        leadStatus = readLeadStatusFromLead(lead);
      } catch (err) {
        stats.errors.push({ email: member.email, stage: 'lead-lookup', reason: err.message });
      }
    }

    if (!isActiveLeadStatus(leadStatus)) {
      stats.excludedByStatus += 1;
      continue;
    }

    stats.active += 1;
    activeMembers.push({ ...member, leadStatus });
  }

  if (dryRun) {
    return {
      ok: true,
      mode: 'dry-run',
      wroteToFirestore: false,
      program: programId,
      rawBatch: batchValue,
      startDate: startDate || null,
      endDate: endDate || null,
      docId,
      displayName,
      ...fetchMeta,
      ...stats,
      learners: (fetchMeta.learners || members.map((m) => ({
        email: m.email,
        name: m.name || m.record?.Last_Name || '',
        leadStatus: m.leadStatus || m.record?._status || '',
      }))).map((learner) => {
        const active = activeMembers.find((a) => a.email === learner.email);
        return {
          ...learner,
          active: Boolean(active),
          leadStatus: active?.leadStatus || learner.leadStatus || '',
        };
      }),
    };
  }

  const { db } = deps;
  if (!db) return { ok: false, reason: 'Firestore db is required for apply' };

  const runRef = db.collection(BATCH_SYNC_RUNS).doc();
  const startedAt = new Date();

  await runRef.set({
    program: programId,
    rawBatch: batchValue,
    startDate: startDate || null,
    endDate: endDate || null,
    batchDocId: docId,
    displayName,
    cohortSource: fetchMeta.source || 'unknown',
    triggeredBy,
    startedAt,
    status: 'running',
    dryRun: false,
    stats: { ...stats },
  });

  try {
    await ensureBatchGroup(db, {
      docId,
      displayName,
      program: programId,
      rawBatch: batchValue,
      triggeredBy,
    });

    const groupRef = db.collection(GROUPS).doc(docId);
    const beforeSnap = await groupRef.get();
    const beforeCount = (beforeSnap.data()?.memberIds || []).length;

    await mapPool(activeMembers, concurrency, async (member) => {
      const { email, record } = member;

      try {
        let uid = await findUserUidByEmail(db, email);

        if (!uid) {
          const provision = await deps.provisionUserFromEmail(db, email);
          if (!provision?.ok) {
            stats.skipped += 1;
            stats.errors.push({
              email,
              stage: 'provision',
              reason: provision?.reason || 'Provision failed',
            });
            return;
          }
          uid = provision.uid;
          if (provision.created) stats.provisioned += 1;
        } else if (member.record._source !== 'leads') {
          await deps.applyEntitlements(
            db,
            uid,
            record,
            (await db.collection('users').doc(uid).get()).data() || {}
          );
        }

        const userSnap = await db.collection('users').doc(uid).get();
        const profile = userSnap.data() || {};
        if (profile.batchId === docId) {
          stats.alreadyInBatch += 1;
          return;
        }

        await assignMemberToBatch(db, {
          groupId: docId,
          groupName: displayName,
          program: programId,
          uid,
        });
        stats.assigned += 1;
      } catch (err) {
        stats.skipped += 1;
        if (stats.errors.length < 25) {
          stats.errors.push({ email, stage: 'assign', reason: err.message || String(err) });
        }
      }
    });

    const afterSnap = await groupRef.get();
    const afterCount = (afterSnap.data()?.memberIds || []).length;

    const finishedAt = new Date();
    await runRef.update({
      status: 'completed',
      finishedAt,
      stats,
      memberCountBefore: beforeCount,
      memberCountAfter: afterCount,
    });

    return {
      ok: true,
      mode: 'apply',
      wroteToFirestore: true,
      runId: runRef.id,
      program: programId,
      rawBatch: batchValue,
      startDate: startDate || null,
      endDate: endDate || null,
      docId,
      displayName,
      ...fetchMeta,
      memberCountBefore: beforeCount,
      memberCountAfter: afterCount,
      ...stats,
    };
  } catch (err) {
    await runRef.update({
      status: 'failed',
      finishedAt: new Date(),
      error: err.message || String(err),
      stats,
    });
    throw err;
  }
}

async function removeMemberFromBatch(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { removed: false, reason: 'user-not-found' };

  const oldBatchId = userSnap.data()?.batchId || null;

  if (oldBatchId) {
    await db.collection(GROUPS).doc(oldBatchId).update({
      memberIds: admin.firestore.FieldValue.arrayRemove(uid),
      updatedAt: new Date(),
    });
  }

  await userRef.set(
    {
      batchId: admin.firestore.FieldValue.delete(),
      batchName: admin.firestore.FieldValue.delete(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return { removed: true, previousBatchId: oldBatchId };
}

function pickBatchPair(pairs, preferredProgramId) {
  if (!pairs?.length) return null;
  if (preferredProgramId) {
    const match = pairs.find((p) => p.programId === preferredProgramId);
    if (match) return match;
  }
  if (pairs.length === 1) return pairs[0];
  return null;
}

function resolveIlUsersBatchTarget(record, preferredProgramId) {
  const pairing = resolvePairing(record);
  if (pairing.status !== 'ok') {
    return { ok: false, reason: pairing.reason, detail: pairing.detail || '' };
  }

  const pair = pickBatchPair(pairing.pairs, preferredProgramId);
  if (!pair) {
    return {
      ok: false,
      reason: 'ambiguous-batch-pairing',
      detail: pairing.pairs.map((p) => `${p.programId}:${p.rawBatch}`).join(' | '),
    };
  }

  const batchInfo = classifyBatchValue(pair.rawBatch);
  if (!batchInfo.ok) {
    return { ok: false, reason: batchInfo.reason || 'invalid-batch-value' };
  }

  return {
    ok: true,
    source: 'il_users',
    programId: pair.programId,
    docId: batchDocId(pair.programId, pair.rawBatch),
    displayName: batchDisplayName(pair.programId, batchInfo),
    batchValue: pair.rawBatch,
  };
}

async function resolveUserBatchTarget(email, deps, existingProfile = null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: 'email-required' };

  const [lead, ilUser, ilRegistration] = await Promise.all([
    deps.getLeadByEmail ? deps.getLeadByEmail(normalized).catch(() => null) : null,
    deps.searchIlUserByEmail ? deps.searchIlUserByEmail(normalized).catch(() => null) : null,
    deps.searchIlRegistrationByEmail
      ? deps.searchIlRegistrationByEmail(normalized).catch(() => null)
      : null,
  ]);

  let leadStatus = readLeadStatusFromLead(lead);
  if (!leadStatus && ilRegistration) {
    const reg = registrationToBatchRecord(ilRegistration);
    leadStatus = reg._status || '';
  }
  if (!leadStatus && ilUser?._status) leadStatus = ilUser._status;

  const preferredProgramId =
    resolveLeadProgramId(lead) ||
    (existingProfile?.program ? String(existingProfile.program).trim().toLowerCase() : null);

  const leadsTarget = resolveLeadCohortFromLead(lead);
  if (leadsTarget) {
    return {
      ok: true,
      action: isActiveLeadStatus(leadStatus) ? 'assign' : 'remove',
      leadStatus,
      target: leadsTarget,
    };
  }

  const mergedRecords = mergeBatchSources(
    ilUser ? [{ ...ilUser, _source: ilUser._source || 'il_users' }] : [],
    ilRegistration ? [ilRegistration] : []
  );
  const batchRecord = mergedRecords[0] || null;

  if (!batchRecord?.Batch) {
    return {
      ok: false,
      reason: 'no-batch-in-zoho',
      leadStatus,
      detail: 'No Leads cohort dates or IL_Users/IL_Registration batch found',
    };
  }

  const ilTarget = resolveIlUsersBatchTarget(batchRecord, preferredProgramId);
  if (!ilTarget.ok) {
    return { ok: false, reason: ilTarget.reason, detail: ilTarget.detail, leadStatus };
  }

  return {
    ok: true,
    action: isActiveLeadStatus(leadStatus) ? 'assign' : 'remove',
    leadStatus,
    target: ilTarget,
  };
}

/**
 * Sync one learner's LMS batch from Zoho (Leads dates or IL_Users / IL_Registration).
 * Moves them between Firestore groups when Zoho batch changes.
 */
async function syncUserBatchFromZoho({ email, dryRun = false, triggeredBy = null, provisionIfMissing = true }, deps) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: 'email is required' };

  const { db } = deps;
  if (!dryRun && !db) return { ok: false, reason: 'Firestore db is required' };

  let uid = db ? await findUserUidByEmail(db, normalized) : null;
  const existingProfile = uid && db ? (await db.collection('users').doc(uid).get()).data() : null;

  const resolved = await resolveUserBatchTarget(normalized, deps, existingProfile);
  if (!resolved.ok) return { ok: false, email: normalized, ...resolved };

  if (resolved.action === 'remove') {
    if (dryRun) {
      return {
        ok: true,
        mode: 'dry-run',
        email: normalized,
        action: 'remove',
        leadStatus: resolved.leadStatus,
        wroteToFirestore: false,
      };
    }
    if (!uid) {
      return {
        ok: true,
        email: normalized,
        action: 'remove',
        skipped: true,
        reason: 'no-lms-user',
        leadStatus: resolved.leadStatus,
      };
    }
    const removal = await removeMemberFromBatch(db, uid);
    return {
      ok: true,
      email: normalized,
      action: 'remove',
      leadStatus: resolved.leadStatus,
      ...removal,
    };
  }

  const { target } = resolved;

  if (dryRun) {
    return {
      ok: true,
      mode: 'dry-run',
      email: normalized,
      action: 'assign',
      leadStatus: resolved.leadStatus,
      program: target.programId,
      batchDocId: target.docId,
      batchName: target.displayName,
      source: target.source,
      wroteToFirestore: false,
    };
  }

  if (!uid && provisionIfMissing && deps.provisionUserFromEmail) {
    const provision = await deps.provisionUserFromEmail(db, normalized);
    if (!provision?.ok) {
      return {
        ok: false,
        email: normalized,
        reason: provision?.reason || 'Provision failed before batch assign',
      };
    }
    uid = provision.uid;
  }

  if (!uid) {
    return { ok: false, email: normalized, reason: 'No LMS user for this email' };
  }

  if (deps.applyEntitlements && resolved.target.source === 'il_users') {
    const ilUser = await deps.searchIlUserByEmail(normalized).catch(() => null);
    if (ilUser) {
      const profile = (await db.collection('users').doc(uid).get()).data() || {};
      await deps.applyEntitlements(db, uid, ilUser, profile);
    }
  }

  const profile = (await db.collection('users').doc(uid).get()).data() || {};
  if (profile.batchId === target.docId) {
    return {
      ok: true,
      email: normalized,
      action: 'assign',
      alreadyInBatch: true,
      batchDocId: target.docId,
      batchName: target.displayName,
      program: target.programId,
      source: target.source,
    };
  }

  await ensureBatchGroup(db, {
    docId: target.docId,
    displayName: target.displayName,
    program: target.programId,
    rawBatch: target.batchValue,
    triggeredBy,
  });

  await assignMemberToBatch(db, {
    groupId: target.docId,
    groupName: target.displayName,
    program: target.programId,
    uid,
  });

  return {
    ok: true,
    email: normalized,
    action: 'assign',
    assigned: true,
    batchDocId: target.docId,
    batchName: target.displayName,
    program: target.programId,
    source: target.source,
    leadStatus: resolved.leadStatus,
    previousBatchId: profile.batchId || null,
  };
}

module.exports = {
  EXCLUDED_LEAD_STATUS,
  isActiveLeadStatus,
  fetchBatchRecords,
  collectBatchMembers,
  applyBatchSync,
  syncUserBatchFromZoho,
  resolveUserBatchTarget,
  removeMemberFromBatch,
  assignMemberToBatch,
  findUserUidByEmail,
};
