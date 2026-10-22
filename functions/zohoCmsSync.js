/**
 * Keep every real batch (LEP, 100BM, MBW) in step with Zoho, gently on the Zoho quota.
 *
 *   - One read per run: IL_Users + IL Registration (Batch field) and Leads cohorts,
 *     all programs together. Never one read per batch, never one call per learner.
 *   - Asks the shared Zoho budget first (background share); skips politely when low.
 *   - Creates / updates LMS batches (groups) and adds learners who already have an
 *     app login. Creates no accounts and writes nothing to Zoho — logins are still
 *     made on first sign-in, exactly as today.
 *   - A learner Zoho now shows in a different batch of the same program leaves the
 *     old one — but only after a complete read, so a partial read never removes anyone.
 *     (Changes in the day reach the LMS at once through zohoBatchUpdateWebhook.)
 *   - Skips batches that ended long ago.
 *   - Writes a plain-language summary the CMS shows to CX (cms_sync_status/zoho).
 *
 * Runs nightly, and on "Sync now" in the CMS (at most once an hour).
 */
const admin = require('firebase-admin');
const zohoBudget = require('./zohoBudget');
const { fetchMergedBatchRecords, buildPlan, classifyBatchValue } = require('./zohoBatchSync');
const { collectBatchMembers, findUserUidByEmail, isActiveLeadStatus } = require('./zohoBatchApply');
const { previewLeadCohorts } = require('./zohoLeadsCohort');

const STATUS_DOC = ['cms_sync_status', 'zoho'];
const GROUPS = 'groups';
const PROGRAMS = new Set(['lep', '100bm', 'mbw']);
const MAX_PAGES = 20;
/** Rough worst case for one run: three record sources plus Leads for three programs. */
const RUN_COST_ESTIMATE = MAX_PAGES * 5;
const MIN_GAP_MS = 60 * 60 * 1000;
const KEEP_DAYS = 400;

function statusRef(db) {
  return db.collection(STATUS_DOC[0]).doc(STATUS_DOC[1]);
}

async function readStatus(db) {
  const snap = await statusRef(db).get();
  return snap.exists ? snap.data() : null;
}

/** Start of a batch in ms, when the batch value says it. Unknown → keep it. */
function batchStartMs(batch) {
  if (batch.startDate) {
    const t = Date.parse(batch.startDate);
    if (Number.isFinite(t)) return t;
  }
  const info = classifyBatchValue(batch.rawBatch || '');
  if (info.ok && info.kind === 'range') return info.start;
  if (info.ok && info.kind === 'month') {
    const t = Date.parse(`1 ${info.value}`);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function isCurrent(batch, now) {
  const start = batchStartMs(batch);
  return start == null || now - start < KEEP_DAYS * 86400000;
}

/** Create or refresh the LMS batch doc — same fields the LMS batch apply writes. */
async function upsertGroup(db, { docId, displayName, program, rawBatch }) {
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
    Object.assign(payload, {
      courseIds: [],
      memberIds: [],
      moderatorIds: [],
      createdBy: 'zoho-sync',
      createdAt: now,
    });
  }
  await ref.set(payload, { merge: true });
  return { ref, existed: existing.exists, memberIds: new Set(existing.data()?.memberIds || []) };
}

/**
 * Add learners who already have an app login to the batch. Membership only — the
 * learner's own profile is left alone (it may belong to another program's batch).
 */
async function linkMembers(db, group, emails) {
  let linked = 0;
  let added = 0;
  let withoutLogin = 0;
  const toAdd = [];
  for (const email of emails) {
    const uid = await findUserUidByEmail(db, email);
    if (!uid) {
      withoutLogin += 1;
      continue;
    }
    linked += 1;
    if (!group.memberIds.has(uid)) toAdd.push(uid);
  }
  for (let i = 0; i < toAdd.length; i += 400) {
    await group.ref.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(...toAdd.slice(i, i + 400)),
      updatedAt: new Date(),
    });
    added += toAdd.slice(i, i + 400).length;
  }
  return { linked, added, withoutLogin };
}

/**
 * For each batch this run touched: a member whose email Zoho listed this run, in this
 * program, but not in this batch, has moved — take her out. Members Zoho did not
 * mention (added by hand, or chosen in the app) are left alone.
 */
async function removeMovedLearners(db, touched, seen) {
  let moved = 0;
  for (const t of touched) {
    const snap = await t.ref.get();
    const memberIds = snap.data()?.memberIds || [];
    if (!memberIds.length) continue;
    const gone = [];
    for (let i = 0; i < memberIds.length; i += 100) {
      const users = await db.getAll(
        ...memberIds.slice(i, i + 100).map((id) => db.collection('users').doc(id))
      );
      users.forEach((u) => {
        const email = String(u.data()?.email || '')
          .trim()
          .toLowerCase();
        const where = email ? seen[t.program].get(email) : null;
        if (where && !where.has(t.docId)) gone.push(u.id);
      });
    }
    if (gone.length) {
      await t.ref.update({
        memberIds: admin.firestore.FieldValue.arrayRemove(...gone),
        updatedAt: new Date(),
      });
      moved += gone.length;
    }
  }
  return moved;
}

async function runZohoCmsSync(db, deps, { trigger = 'nightly', by = null } = {}) {
  const startedAt = new Date();
  const now = Date.now();
  const before = await zohoBudget.status(db);
  const budget = await zohoBudget.canSpend(db, zohoBudget.PRIORITY.BACKGROUND, RUN_COST_ESTIMATE);
  if (!budget.ok) {
    const skipped = {
      state: 'skipped',
      trigger,
      by,
      startedAt,
      finishedAt: new Date(),
      message:
        'Skipped to protect the Zoho daily limit (learner logins come first). It will run again tonight.',
      zohoCallsToday: before.spent,
      zohoBackgroundLimit: before.backgroundCeiling,
    };
    await statusRef(db).set(skipped, { merge: true });
    return skipped;
  }

  await statusRef(db).set({ state: 'running', trigger, by, startedAt }, { merge: true });

  const perProgram = {
    lep: { batches: 0, learners: 0 },
    '100bm': { batches: 0, learners: 0 },
    mbw: { batches: 0, learners: 0 },
  };
  const totals = {
    batches: 0,
    newBatches: 0,
    learnersLinked: 0,
    learnersAdded: 0,
    learnersWithoutLogin: 0,
    learnersMoved: 0,
    skippedOld: 0,
  };
  const problems = [];
  // email → batches Zoho says she is in, per program; and every batch touched, to tidy moves.
  const seen = { lep: new Map(), '100bm': new Map(), mbw: new Map() };
  const touched = [];
  let complete = true;

  const handle = async (batch, emails) => {
    if (!PROGRAMS.has(batch.program)) return;
    if (!isCurrent(batch, now)) {
      totals.skippedOld += 1;
      return;
    }
    const group = await upsertGroup(db, batch);
    emails.forEach((email) => {
      const key = String(email || '')
        .trim()
        .toLowerCase();
      if (!key) return;
      if (!seen[batch.program].has(key)) seen[batch.program].set(key, new Set());
      seen[batch.program].get(key).add(batch.docId);
    });
    touched.push({ ref: group.ref, docId: batch.docId, program: batch.program });
    const r = await linkMembers(db, group, emails);
    totals.batches += 1;
    if (!group.existed) totals.newBatches += 1;
    totals.learnersLinked += r.linked;
    totals.learnersAdded += r.added;
    totals.learnersWithoutLogin += r.withoutLogin;
    perProgram[batch.program].batches += 1;
    perProgram[batch.program].learners += r.linked;
  };

  try {
    // 1. IL_Users + IL Registration "Batch" values — one read, every program.
    const records = await fetchMergedBatchRecords({ maxPages: MAX_PAGES }, deps);
    const plan = buildPlan(records.rows);
    for (const b of plan.plannedBatches) {
      const members = collectBatchMembers(records.rows, b.program, b.rawBatch).map((m) => m.email);
      await handle(
        { docId: b.docId, displayName: b.displayName, program: b.program, rawBatch: b.rawBatch },
        members
      );
    }
    if (records.truncated) {
      complete = false;
      problems.push('Zoho has more batch records than one run reads; the rest come next run.');
    }

    // 2. Leads cohorts (start/end dates per program) — one read per program.
    try {
      const leads = await previewLeadCohorts({ maxPages: MAX_PAGES }, deps);
      for (const c of leads.plannedCohorts || []) {
        const cohort = [...(leads.cohortsByKey?.values() || [])].find((x) => x.docId === c.docId);
        // Lead status is already in the record — no extra Zoho call per learner.
        const emails = cohort
          ? [...cohort.members.values()]
              .filter((m) => isActiveLeadStatus(m.leadStatus))
              .map((m) => m.email)
          : [];
        await handle(
          {
            docId: c.docId,
            displayName: c.displayName,
            program: c.program,
            rawBatch: c.rawBatch,
            startDate: c.startDate,
          },
          emails
        );
      }
      if (leads.truncated) {
        complete = false;
        problems.push('Some Leads were not read this run; they come next run.');
      }
    } catch (err) {
      complete = false;
      problems.push(`Leads could not be read this time (${err.message || err}).`);
    }

    // Learners who moved to another batch of the same program leave the old one.
    if (complete) totals.learnersMoved = await removeMovedLearners(db, touched, seen);
    else problems.push('Learners who changed batch are moved on the next complete sync.');
  } catch (err) {
    const failed = {
      state: 'failed',
      trigger,
      by,
      startedAt,
      finishedAt: new Date(),
      message: `Zoho could not be read: ${err.message || err}. Nothing was changed. It will try again tonight.`,
    };
    await statusRef(db).set(failed, { merge: true });
    return failed;
  }

  const after = await zohoBudget.status(db);
  const done = {
    state: 'ok',
    trigger,
    by,
    startedAt,
    finishedAt: new Date(),
    ...totals,
    perProgram,
    problems,
    zohoCallsUsed: Math.max(0, after.spent - before.spent),
    zohoCallsToday: after.spent,
    zohoBackgroundLimit: after.backgroundCeiling,
  };
  await statusRef(db).set(done, { merge: false });
  return done;
}

/** "Sync now" from the CMS — at most once an hour, never while a run is going. */
async function runZohoCmsSyncNow(db, deps, uid) {
  const last = await readStatus(db);
  const lastStart = last?.startedAt?.toMillis ? last.startedAt.toMillis() : 0;
  if (last?.state === 'running' && Date.now() - lastStart < 15 * 60 * 1000) {
    return { ok: false, message: 'A sync is already running. Check back in a few minutes.' };
  }
  if (Date.now() - lastStart < MIN_GAP_MS) {
    const nextAt = new Date(lastStart + MIN_GAP_MS);
    return {
      ok: false,
      message: `Synced less than an hour ago. To save the Zoho limit, the next “Sync now” is available after ${nextAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}.`,
    };
  }
  const result = await runZohoCmsSync(db, deps, { trigger: 'manual', by: uid });
  return { ok: result.state === 'ok', ...result };
}

module.exports = { runZohoCmsSync, runZohoCmsSyncNow, readStatus, isCurrent };
