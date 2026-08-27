/**
 * IL LMS — Firebase Cloud Functions
 *
 * SETUP:
 *   1. cd functions && npm install
 *   2. Zoho CRM credentials — copy functions/.env.example → functions/.env
 *      (deploy loads this automatically). Optional: firebase functions:secrets:set …
 *   3. SMTP secrets (optional — weekly MBW reminder):
 *        firebase functions:secrets:set SMTP_HOST
 *        firebase functions:secrets:set SMTP_USER
 *        firebase functions:secrets:set SMTP_PASS
 *   4. Deploy: firebase deploy --only functions
 *
 * Zoho sync runs automatically on user profile changes and new activities.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const zoho = require('./zoho');
const zohoBudget = require('./zohoBudget');
const { parseWebhookBody, hasWebhookCredentials } = require('./webhookBody');
const {
  needsEntitlementBackfill,
  enrolledProgramIds,
  normalizePaymentStatus,
  PAYMENT_STATUS,
} = require('./accessTiers');
const { FAILURES, buildFailureDigest } = require('./syncAlerts');

admin.initializeApp();
const db = admin.firestore();

const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

/** Bulk push can run for many users — default 60s timeout surfaces as a browser CORS error. */
const ZOHO_BULK_SYNC_OPTS = {
  timeoutSeconds: 540,
  memory: '512MiB',
};

/** Login callable — asia-south1 matches India users + Zoho .in API (no minInstances = no always-on cost). */
const LOGIN_FN_OPTS = {
  region: 'asia-south1',
};

async function syncAllUsersToZohoPool(db, docs, concurrency = 4) {
  const outcomes = [];
  let next = 0;

  async function worker() {
    while (next < docs.length) {
      const doc = docs[next++];
      const profile = doc.data();
      if (!profile?.email) continue;
      try {
        const result = await zoho.syncUserToZoho(db, doc.id, profile, { syncCredentials: true });
        outcomes.push({ email: profile.email, result });
      } catch (err) {
        outcomes.push({ email: profile.email, error: err.message });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, docs.length || 1) }, () => worker())
  );

  let synced = 0;
  let failed = 0;
  const errors = [];
  for (const entry of outcomes) {
    if (entry.result?.synced) {
      synced += 1;
    } else {
      failed += 1;
      if (errors.length < 5) {
        errors.push(`${entry.email}: ${entry.result?.reason || entry.error || 'Sync failed'}`);
      }
    }
  }

  return { synced, failed, errors };
}

// ── Helpers ───────────────────────────────────────────────────
function currentWeekLabel() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86_400_000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function getRecurringPostTaskIds() {
  const snap = await db.collection('mbw_tasks').where('type', 'in', ['recurring_post']).get();
  return snap.docs.map((d) => d.id);
}

async function getUsersNeedingReminder(taskIds, weekLabel) {
  // Find all users who have a recurring_post submission but haven't posted this week
  const usersSnap = await db.collection('users').get();
  const pending = [];

  for (const userDoc of usersSnap.docs) {
    const user = { id: userDoc.id, ...userDoc.data() };
    for (const taskId of taskIds) {
      const subId = `${user.id}_${taskId}`;
      const subDoc = await db.collection('mbw_submissions').doc(subId).get();
      if (!subDoc.exists) {
        // Never submitted — eligible for reminder
        pending.push({ user, taskId });
        continue;
      }
      const sub = subDoc.data();
      const entries = sub.weekEntries ?? [];
      const posted = entries.some((e) => e.weekLabel === weekLabel);
      if (!posted) pending.push({ user, taskId });
    }
  }
  return pending;
}

async function sendReminderEmail(transport, to, name) {
  await transport.sendMail({
    from: `"Iron Lady LMS" <${process.env.SMTP_USER}>`,
    to,
    subject: '📣 Weekly LinkedIn post reminder — MBW Program',
    html: `
      <p>Hi ${name || 'there'},</p>
      <p>
        This is your weekly nudge to share your LinkedIn post as part of the
        MBW networking task. Consistent posting builds your leadership brand —
        and your community is watching! 💪
      </p>
      <p>
        <a href="https://lms.ironlady.in/app/mbw" style="background:#C8102E;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">
          Submit your post link →
        </a>
      </p>
      <p>See you on the other side,<br/>Iron Lady Team</p>
    `,
  });
}

// ── Scheduled function — runs every Monday 8:00 AM IST ────────
/**
 * Hourly digest of Zoho sync failures.
 *
 * Failures used to go to the Cloud Function log and nowhere else, which is why
 * the outbound sync could fail for every learner for weeks without anyone
 * noticing — the log is where you look once you already suspect something.
 *
 * One mail per failure would be no better: a bulk sync fails for the whole
 * cohort at once, and five hundred identical mails get filtered within a day.
 * This groups by cause, so the subject line carries the actual problem.
 */
exports.zohoSyncFailureDigest = onSchedule(
  {
    schedule: '15 * * * *',
    timeZone: 'Asia/Kolkata',
    secrets: [SMTP_HOST, SMTP_USER, SMTP_PASS],
  },
  async () => {
    const snap = await db
      .collection(FAILURES)
      .where('notified', '==', false)
      .limit(500)
      .get();

    if (snap.empty) return;

    const digest = buildFailureDigest(snap.docs.map((d) => d.data()));
    if (!digest) return;

    const transport = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: 465,
      secure: true,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });

    await transport.sendMail({
      from: `"Iron Lady LMS" <${SMTP_USER.value()}>`,
      to: digest.to,
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
    });

    /*
     * Marked only after the mail is away. A send that throws leaves the records
     * unnotified and the next run retries them — a repeated alert is a nuisance,
     * a silently dropped one puts us back where we started.
     */
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { notified: true, notifiedAt: new Date() }));
    await batch.commit();

    console.log(`Zoho failure digest sent: ${digest.total} failures, ${digest.groups.length} causes`);
  }
);

exports.weeklyLinkedInReminder = onSchedule(
  {
    schedule: '30 2 * * 1', // Monday 02:30 UTC = 08:00 IST
    timeZone: 'Asia/Kolkata',
    secrets: [SMTP_HOST, SMTP_USER, SMTP_PASS],
  },
  async () => {
    const weekLabel = currentWeekLabel();
    console.log(`Running LinkedIn reminders for ${weekLabel}`);

    const transport = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: 587,
      secure: false,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });

    const taskIds = await getRecurringPostTaskIds();
    if (taskIds.length === 0) {
      console.log('No recurring post tasks found.');
      return;
    }

    const pending = await getUsersNeedingReminder(taskIds, weekLabel);
    console.log(`Sending reminders to ${pending.length} participant(s).`);

    // Deduplicate by user (one email even if multiple tasks are pending)
    const seen = new Set();
    for (const { user } of pending) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      if (!user.email) continue;
      try {
        await sendReminderEmail(transport, user.email, user.displayName);
        console.log(`Sent reminder to ${user.email}`);
      } catch (err) {
        console.error(`Failed to send to ${user.email}:`, err.message);
      }
    }
  }
);

// ── FCM helpers ───────────────────────────────────────────────
async function clearExpiredToken(uid) {
  await db.collection('users').doc(uid).update({ fcmToken: null });
}

async function trySend(message, uid) {
  try {
    await admin.messaging().send(message);
    return true;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      await clearExpiredToken(uid);
    }
    console.error(`FCM send failed for ${uid}:`, err.message);
    return false;
  }
}

// ── CX: send task reminder to one learner ─────────────────────
exports.sendTaskReminder = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await zoho.assertStaff(db, request.auth.uid);

  const { userId, taskId } = request.data || {};
  if (!userId || !taskId) throw new HttpsError('invalid-argument', 'userId and taskId required');

  const [userDoc, taskDoc] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('mbw_tasks').doc(taskId).get(),
  ]);

  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');

  const { fcmToken, displayName } = userDoc.data();
  if (!fcmToken) return { sent: false, reason: 'no_token' };

  const taskTitle = taskDoc.exists ? taskDoc.data().title || taskId : taskId;
  const firstName = (displayName || '').split(' ')[0] || 'there';

  const sent = await trySend(
    {
      token: fcmToken,
      notification: {
        title: 'Task Reminder',
        body: `Hi ${firstName}, your task "${taskTitle}" is waiting for you. Complete it today!`,
      },
      data: { type: 'task_reminder', taskId, userId },
    },
    userId
  );

  if (sent) {
    await db.collection('notifications').add({
      type: 'task_reminder',
      sentTo: userId,
      sentBy: request.auth.uid,
      taskId,
      taskTitle,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { sent };
});

// ── CX: notify learner that their task was reviewed ───────────
exports.sendReviewNotification = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await zoho.assertStaff(db, request.auth.uid);

  const { userId, taskId, taskTitle: titleFromClient, outcome, feedback } = request.data || {};
  if (!userId || !taskId) throw new HttpsError('invalid-argument', 'userId and taskId required');

  const [userDoc, mbwTaskDoc, bm100TaskDoc] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('mbw_tasks').doc(taskId).get(),
    db.collection('bm100_tasks').doc(taskId).get(),
  ]);

  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');

  const { fcmToken, displayName } = userDoc.data();
  if (!fcmToken) return { sent: false, reason: 'no_token' };

  const taskTitle =
    titleFromClient ||
    (mbwTaskDoc.exists && mbwTaskDoc.data().title) ||
    (bm100TaskDoc.exists && bm100TaskDoc.data().title) ||
    taskId;

  const firstName = (displayName || '').split(' ')[0] || 'there';
  const outcomeLabel =
    outcome === 'approved'
      ? 'Approved'
      : outcome === 'needs_improvement'
        ? 'Needs improvement'
        : outcome === 'rejected'
          ? 'Rejected'
          : 'Updated';

  const feedbackSnippet = feedback ? String(feedback).trim().slice(0, 100) : '';
  const body = feedbackSnippet
    ? `Hi ${firstName}, "${taskTitle}" was reviewed: ${outcomeLabel}. ${feedbackSnippet}`
    : `Hi ${firstName}, your task "${taskTitle}" was reviewed: ${outcomeLabel}. Open the LMS to see details.`;

  const sent = await trySend(
    {
      token: fcmToken,
      notification: {
        title: 'Task review ready',
        body,
      },
      data: {
        type: 'task_review',
        taskId: String(taskId),
        userId: String(userId),
        outcome: String(outcome || ''),
      },
    },
    userId
  );

  if (sent) {
    await db.collection('notifications').add({
      type: 'task_review',
      sentTo: userId,
      sentBy: request.auth.uid,
      taskId,
      taskTitle,
      outcome: outcome || '',
      feedback: feedbackSnippet,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { sent };
});

// ── CX: send session reminder to all learners in a batch ──────
exports.sendSessionReminder = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await zoho.assertStaff(db, request.auth.uid);

  const { batchId, message: customMessage } = request.data || {};
  if (!batchId) throw new HttpsError('invalid-argument', 'batchId required');

  const batchDoc = await db.collection('groups').doc(batchId).get();
  if (!batchDoc.exists) throw new HttpsError('not-found', 'Batch not found');

  const { name: batchName = 'your batch', memberIds = [] } = batchDoc.data();
  if (memberIds.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const memberDocs = await Promise.all(
    memberIds.map((uid) => db.collection('users').doc(uid).get())
  );

  const targets = memberDocs
    .filter((d) => d.exists && d.data().fcmToken)
    .map((d) => ({ uid: d.id, token: d.data().fcmToken }));

  if (targets.length === 0) return { sent: 0, failed: 0, skipped: memberIds.length };

  const body =
    customMessage || `Session reminder for ${batchName}. Check your LMS for the latest updates.`;

  const result = await admin.messaging().sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    notification: { title: 'Session Reminder', body },
    data: { type: 'session_reminder', batchId },
  });

  // Clear expired tokens in the background
  result.responses.forEach((resp, i) => {
    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
      clearExpiredToken(targets[i].uid).catch(() => {});
    }
  });

  await db.collection('notifications').add({
    type: 'session_reminder',
    batchId,
    batchName,
    message: body,
    sentBy: request.auth.uid,
    memberCount: memberIds.length,
    sentCount: result.successCount,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    sent: result.successCount,
    failed: result.failureCount,
    skipped: memberIds.length - targets.length,
  };
});

// ── Zoho CRM — auto-sync on user profile changes ──────────────
exports.onUserProfileZohoSync = onDocumentWritten({ document: 'users/{userId}' }, async (event) => {
  if (!zoho.isConfigured()) return;

  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after?.email) return;
  if (!zoho.userProfileChanged(before, after)) return;

  const userId = event.params.userId;
  try {
    await zoho.syncUserToZoho(db, userId, after);
  } catch (err) {
    console.error(`Zoho user sync failed for ${userId}:`, err.message);
  }
});

// ── Zoho CRM — activity notes on new LMS activities ───────────
exports.onActivityZohoNote = onDocumentCreated(
  { document: 'activities/{activityId}' },
  async (event) => {
    if (!zoho.isConfigured()) return;

    const activity = event.data?.data();
    if (!activity?.userId) return;

    // One note per activity is the highest-volume automatic call into Zoho.
    // It is a CRM nicety, not something a learner is waiting on, so it is the
    // first thing to stop when the day's background allowance runs out.
    const budget = await zohoBudget.canSpend(db, zohoBudget.PRIORITY.BACKGROUND, 1);
    if (!budget.ok) return;

    try {
      await zoho.logActivityToZoho(db, activity);
    } catch (err) {
      console.error('Zoho activity note failed:', err.message);
    }
  }
);

// ── Zoho CRM — admin: test connection ─────────────────────────
exports.zohoTestConnection = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertStaff(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured on Cloud Functions' };
  }

  const token = await zoho.getAccessToken();
  if (!token) {
    return { ok: false, reason: 'Failed to refresh Zoho access token' };
  }

  return { ok: true, configured: true };
});

// ── Zoho batch mapping — PREVIEW ONLY (writes nothing, anywhere) ──
// Reports which LMS batches WOULD be created from IL_Users, plus every record
// that needs a human decision. There is deliberately no "apply" counterpart yet.
exports.zohoBatchSyncPreview = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertStaff(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured on Cloud Functions' };
  }

  const { maxPages = 10 } = request.data || {};

  try {
    const report = await zoho.previewBatchSync({
      maxPages: Math.min(Math.max(Number(maxPages) || 10, 1), 50),
    });
    return { ok: true, ...report };
  } catch (err) {
    console.error('zohoBatchSyncPreview failed:', err);
    return { ok: false, reason: err.message || String(err) };
  }
});

// ── Zoho batch apply — creates Firestore batch + assigns learners ──
exports.zohoBatchSyncApply = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured on Cloud Functions' };
  }

  const {
    program,
    rawBatch,
    startDate,
    endDate,
    dryRun = true,
    maxPages = 50,
  } = request.data || {};

  if (!program) {
    throw new HttpsError('invalid-argument', 'program is required');
  }
  if (!startDate && !endDate && !rawBatch) {
    throw new HttpsError(
      'invalid-argument',
      'Provide startDate + endDate (Leads cohort) or rawBatch (IL_Users)'
    );
  }

  try {
    const report = await zoho.applyBatchSync(db, {
      program: String(program).trim().toLowerCase(),
      rawBatch: rawBatch ? String(rawBatch).trim() : undefined,
      startDate: startDate ? String(startDate).trim() : undefined,
      endDate: endDate ? String(endDate).trim() : undefined,
      dryRun: dryRun !== false,
      maxPages: Math.min(Math.max(Number(maxPages) || 50, 1), 50),
      triggeredBy: request.auth.uid,
    });
    return report;
  } catch (err) {
    console.error('zohoBatchSyncApply failed:', err);
    return { ok: false, reason: err.message || String(err) };
  }
});

/**
 * Sync one page of IL Registration + Contacts into LMS accounts / paid status.
 * Dry-run by default. Continue with nextPage until moreRecords is false.
 */
exports.zohoRosterSync = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured on Cloud Functions' };
  }

  const {
    dryRun = true,
    source = 'both',
    page = 1,
    perPage = 50,
    createUnpaid = false,
  } = request.data || {};

  try {
    return await zoho.runRosterSync(db, {
      dryRun: dryRun !== false,
      source: String(source || 'both'),
      page: Math.max(1, Number(page) || 1),
      perPage: Math.min(Math.max(Number(perPage) || 50, 1), 100),
      createUnpaid: createUnpaid === true,
      triggeredBy: request.auth.uid,
    });
  } catch (err) {
    console.error('zohoRosterSync failed:', err);
    return { ok: false, reason: err.message || String(err), code: err.code || null };
  }
});

// ── Zoho → LMS: sync one learner's batch (admin callable) ─────
exports.zohoSyncUserBatch = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured on Cloud Functions' };
  }

  const email = (request.data?.email || '').trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'email is required');
  }

  try {
    return await zoho.syncUserBatchFromZoho(db, email, {
      dryRun: request.data?.dryRun === true,
      triggeredBy: request.auth.uid,
      provisionIfMissing: request.data?.provisionIfMissing !== false,
    });
  } catch (err) {
    console.error('zohoSyncUserBatch failed:', err);
    return { ok: false, reason: err.message || String(err) };
  }
});

async function handleZohoBatchWebhook(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers['x-zoho-webhook-secret'] || req.headers['x-webhook-secret'];
    if (headerSecret !== secret) {
      res.status(401).json({ ok: false, reason: 'Unauthorized' });
      return;
    }
  }

  const body = parseWebhookBody(req);
  const email = (body.email || body.Email || '').trim();

  if (!email) {
    res.status(400).json({
      ok: false,
      reason: 'email is required — trigger when Batch or cohort dates change in Zoho',
    });
    return;
  }

  if (!zoho.isConfigured()) {
    res.status(503).json({
      ok: false,
      reason: 'Zoho OAuth not configured on Cloud Functions',
    });
    return;
  }

  try {
    const result = await zoho.syncUserBatchFromZoho(db, email, {
      triggeredBy: 'batch-webhook',
      provisionIfMissing: body.provisionIfMissing !== false,
    });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error('Zoho batch webhook failed:', err.message);
    res.status(500).json({ ok: false, reason: err.message });
  }
}

// ── Zoho webhook — batch/cohort change → update LMS batch membership ──
exports.zohoBatchUpdateWebhook = onRequest({ cors: true }, handleZohoBatchWebhook);

// ── Zoho CRM — admin: sync all users ──────────────────────────
exports.zohoSyncAllUsers = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  try {
    const snap = await db.collection('users').get();
    const docs = snap.docs;
    const { synced, failed, errors } = await syncAllUsersToZohoPool(db, docs);
    return { ok: true, total: snap.size, synced, failed, errors };
  } catch (err) {
    console.error('zohoSyncAllUsers failed:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message || 'Bulk Zoho sync failed');
  }
});

/*
 * Backfill: pull entitlements from Zoho for every profile still on the old flat
 * shape.
 *
 * Before payment was tracked per programme, one flat paymentStatus covered a
 * whole profile, and it still wins by fallback wherever a programme has no
 * entry of its own — so a learner who paid a registration fee reads as fully
 * paid for everything they are enrolled in, and the padlocks never appear.
 * Provisioning one learner from the admin screen fixes one; this is the same
 * call in a loop.
 *
 * Dry run by default. This writes to live learner access and costs two Zoho
 * lookups per learner, so the caller has to ask for the write explicitly and
 * choose how many to do — Zoho's daily API credits are the real ceiling, not
 * the function timeout.
 */
exports.zohoBackfillEntitlements = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const { dryRun = true, limit = 25 } = request.data || {};
  const batchSize = Math.max(1, Math.min(Number(limit) || 25, 200));

  const snap = await db.collection('users').get();
  const stale = snap.docs.filter((d) => needsEntitlementBackfill(d.data()));

  if (dryRun) {
    /*
     * A bare "0 need it" is indistinguishable from a selector that matches
     * nothing, and the second is far more likely to be true than the first.
     * The breakdown says which: if almost every profile is flat-unpaid or
     * enrolled in nothing, zero is real; if many carry a paid tier and no
     * per-programme entry, the selector is wrong.
     */
    let flatGranting = 0;
    let noProgramme = 0;
    let hasPerProgramme = 0;
    snap.docs.forEach((d) => {
      const p = d.data() || {};
      if (normalizePaymentStatus(p.paymentStatus) !== PAYMENT_STATUS.UNPAID) flatGranting += 1;
      if (!enrolledProgramIds(p).length) noProgramme += 1;
      if (p.programAccess && Object.keys(p.programAccess).length) hasPerProgramme += 1;
    });

    return {
      ok: true,
      dryRun: true,
      scanned: snap.size,
      needing: stale.length,
      breakdown: {
        flatTierGrantsAccess: flatGranting,
        enrolledInNothing: noProgramme,
        alreadyPerProgramme: hasPerProgramme,
      },
      // Enough to eyeball before committing, not the whole list.
      sample: stale.slice(0, 20).map((d) => d.data().email),
    };
  }

  const targets = stale.slice(0, batchSize);
  const results = [];
  // Serial on purpose: Zoho rate-limits, and a backfill that trips the limit
  // leaves half the cohort in the broken state it started in.
  for (const doc of targets) {
    const email = doc.data().email;
    try {
      const r = await zoho.provisionUserFromEmail(db, email);
      results.push({ email, ok: !!r?.ok, reason: r?.ok ? null : r?.reason || null });
    } catch (err) {
      results.push({ email, ok: false, reason: err.message || 'failed' });
    }
  }

  const changed = results.filter((r) => r.ok).length;
  return {
    ok: true,
    dryRun: false,
    scanned: snap.size,
    needing: stale.length,
    processed: results.length,
    changed,
    failed: results.length - changed,
    remaining: Math.max(0, stale.length - results.length),
    errors: results.filter((r) => !r.ok).slice(0, 10),
  };
});

/**
 * The reconciler, on a timer.
 *
 * Every other route into the LMS is Zoho choosing to push — the conversion
 * functions on payment, the status rule on a Lead Status edit. Both are the
 * same mechanism, so when Zoho does not fire they fail together and nothing
 * ever tries again. This asks the opposite question every three minutes: what
 * changed in IL Users, and have I handled it?
 *
 * Three minutes because a learner who has just been emailed their credentials
 * tries to use them immediately. The instant path still exists — a first login
 * provisions on the spot — so this is the backstop for everyone who does not
 * try straight away, or whose credential does not match.
 */
exports.zohoReconcileLearners = onSchedule(
  {
    // Every 3 minutes was 480 passes a day against Zoho whether or not
    // anything had changed. zohoLeadWebhook already pushes changes here in
    // real time; this pass is the net for anything the webhook missed, and a
    // net does not need to be checked twenty times an hour.
    schedule: '*/15 * * * *',
    timeZone: 'Asia/Kolkata',
    timeoutSeconds: 300,
    memory: '512MiB',
    // One pass at a time. Two overlapping runs would read the same watermark
    // and do the same work twice.
    maxInstances: 1,
  },
  async () => {
    if (!zoho.isConfigured()) return;
    // Background work yields the last of the day's quota to people waiting on
    // a login or a password reset. Skipping a pass costs nothing: the next one
    // picks up from the same watermark.
    const budget = await zohoBudget.canSpend(db, zohoBudget.PRIORITY.BACKGROUND, 10);
    if (!budget.ok) {
      console.warn(
        `Reconcile skipped: Zoho budget ${budget.spent}/${budget.ceiling} for background work`
      );
      return;
    }
    try {
      const result = await zoho.runZohoReconcile(db, {});
      if (result.provisioned || result.refreshed || result.failed) {
        console.log(
          `Reconcile: scanned ${result.scanned}, provisioned ${result.provisioned}, ` +
            `refreshed ${result.refreshed}, failed ${result.failed}`
        );
      }
    } catch (err) {
      // Recorded rather than thrown: a schedule that crashes is retried by the
      // platform with no watermark protection, and the digest is where a human
      // will actually see this.
      console.error('Reconcile pass failed:', err.message);
      await db
        .collection(FAILURES)
        .add({
          email: null,
          message: `Reconciler pass failed: ${err.message}`,
          direction: 'zoho-to-lms',
          notified: false,
          at: new Date(),
        })
        .catch(() => {});
    }
  }
);

/**
 * Catch-up: run the reconciler over a window that has already passed.
 *
 * The scheduled pass only ever looks forward from its watermark, so learners
 * lost before it existed are invisible to it — the registrations dropped
 * between the ninth and the seventeenth of August among them. This points the
 * same logic at a date the caller chooses.
 *
 * The live watermark is untouched: a sweep of last month has no business
 * rewinding what the scheduled pass is tracking now.
 *
 * Unlike the scheduled pass it does not stop at the first failure. There is no
 * watermark to protect here, and the point is to rescue as many of a known list
 * as possible rather than to halt on one bad record.
 */
exports.zohoCatchUp = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);
  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const { since, dryRun = true, limit = 100, offset = 0 } = request.data || {};
  const from = new Date(since);
  if (!since || Number.isNaN(from.getTime())) {
    throw new HttpsError('invalid-argument', 'A valid start date is required');
  }
  if (from.getTime() > Date.now()) {
    throw new HttpsError('invalid-argument', 'Start date is in the future');
  }

  const pageSize = Math.max(1, Math.min(Number(limit) || 200, 200));
  const isDry = dryRun !== false;

  /*
   * Page through the whole window here rather than making a human click once
   * per two hundred records. Bounded three ways: a page cap, a wall-clock
   * budget short of the function timeout, and stopping the moment Zoho says
   * there is nothing more.
   */
  const MAX_PAGES = 12;
  const BUDGET_MS = 6 * 60 * 1000;
  const startedAt = Date.now();

  const total = {
    ok: true,
    dryRun: isDry,
    scanned: 0,
    provisioned: 0,
    refreshed: 0,
    skipped: 0,
    failed: 0,
    pages: 0,
    sample: [],
  };

  let cursor = Math.max(0, Number(offset) || 0);

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await zoho.runZohoReconcile(db, {
      since: from.toISOString(),
      dryRun: isDry,
      limit: pageSize,
      offset: cursor,
      stopOnFailure: false,
    });

    total.scanned += res.scanned || 0;
    total.provisioned += res.provisioned || 0;
    total.refreshed += res.refreshed || 0;
    total.skipped += res.skipped || 0;
    total.failed += res.failed || 0;
    total.pages += 1;
    if (total.sample.length < 20 && res.sample?.length) {
      total.sample.push(...res.sample.slice(0, 20 - total.sample.length));
    }

    cursor += res.scanned || 0;
    if (!res.more) {
      total.more = false;
      break;
    }
    total.more = true;
    // Leave the caller somewhere to resume from if a bound stopped us early.
    total.nextOffset = cursor;
    if (Date.now() - startedAt > BUDGET_MS) break;
  }

  return total;
});

/**
 * "I just paid — why is this still locked?"
 *
 * The webhook normally unlocks within a second and the reconciler catches
 * anything it drops, but the reconciler runs on a timer, and the worst moment
 * to wait three minutes is right after paying. This lets the learner — or their
 * sign-in — pull their own entitlements immediately.
 *
 * Called by learners, not staff, so it is deliberately narrow: it reads
 * request.auth.uid and nothing else, so nobody can refresh, inspect, or
 * influence another account with it.
 *
 * Throttled hard. Every call costs Zoho lookups, and this fleet rate-limited
 * itself out of Zoho once already today by asking too often. Inside the window
 * it returns the cached answer without touching Zoho at all, so a learner
 * leaning on the button costs nothing.
 */
const SELF_REFRESH_THROTTLE_MS = 60 * 1000;

exports.refreshMyAccess = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  if (!zoho.isConfigured()) return { ok: false, reason: 'not-configured' };

  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { ok: false, reason: 'no-profile' };

  const profile = snap.data() || {};
  const email = (profile.email || '').trim();
  if (!email) return { ok: false, reason: 'no-email' };

  const lastSynced = profile.zohoEntitlementsSyncedAt?.toMillis?.()
    ?? (profile.zohoEntitlementsSyncedAt ? new Date(profile.zohoEntitlementsSyncedAt).getTime() : 0);
  if (lastSynced && Date.now() - lastSynced < SELF_REFRESH_THROTTLE_MS) {
    return { ok: true, throttled: true, syncedAt: lastSynced };
  }

  try {
    const result = await zoho.syncEntitlementsFromZoho(db, email, null);
    return { ok: result?.ok !== false, throttled: false, reason: result?.reason || null };
  } catch (err) {
    // A refresh that cannot reach Zoho must not look like a refused payment.
    console.warn('refreshMyAccess failed for', email, err.message);
    return { ok: false, reason: 'zoho-unreachable' };
  }
});

/** Admin: see what the reconciler would do, without it doing anything. */
exports.zohoReconcilePreview = onCall(ZOHO_BULK_SYNC_OPTS, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);
  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }
  const limit = Math.max(1, Math.min(Number(request.data?.limit) || 50, 200));
  return zoho.runZohoReconcile(db, { dryRun: true, limit });
});

// ── Zoho CRM — admin: sync one user ───────────────────────────
exports.zohoSyncUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  const { userId } = request.data || {};
  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId is required');
  }

  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'User not found');
  }

  const result = await zoho.syncUserToZoho(db, userId, snap.data(), { syncCredentials: true });
  return { ok: result.synced, ...result };
});

// ── Zoho CRM — sync credential after signup / login / reset ───
exports.syncPasswordResetToZoho = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  if (!zoho.isConfigured()) {
    return { synced: false, reason: 'Zoho not configured' };
  }

  const newPassword = request.data?.newPassword;
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'A valid password is required');
  }

  const uid = request.auth.uid;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'User profile not found');
  }

  const phase = request.data?.phase === 'login' ? 'login' : 'after_reset';

  const result =
    phase === 'login'
      ? await zoho.syncCredentialOnAuth(db, uid, snap.data(), newPassword)
      : await zoho.syncPasswordCredentialToZoho(db, uid, snap.data(), newPassword, {
          status: 'Password updated via LMS (post-reset)',
        });
  return { ok: result.synced, ...result };
});

// ── Zoho CRM — snapshot current credential before reset email ─
exports.syncCredentialBeforeReset = onCall(async (request) => {
  if (!zoho.isConfigured()) {
    return { synced: false, reason: 'Zoho not configured' };
  }

  const email = request.data?.email?.trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  const result = await zoho.syncStoredCredentialBeforeReset(db, email);
  return { ok: result.synced, ...result };
});

// ── Zoho CRM — provision LMS user from Lead (admin or webhook) ─
exports.zohoProvisionUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho not configured' };
  }

  const email = request.data?.email?.trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  return zoho.provisionUserFromEmail(db, email);
});

// ── Zoho CRM — admin: browse Leads / IL_Users directory ─────────
exports.zohoListLeads = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const { page = 1, perPage = 50 } = request.data || {};
  return zoho.listLeadsPage({ page, perPage });
});

exports.zohoListIlUsers = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const { page = 1, perPage = 50 } = request.data || {};
  return zoho.listIlUsersPage({ page, perPage });
});

exports.zohoListIlRegistration = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const { page = 1, perPage = 50 } = request.data || {};
  return zoho.listIlRegistrationPage({ page, perPage });
});

// ── Zoho CRM — first login: create Firebase user from IL_Users credentials ─
exports.ensureZohoUserOnLogin = onCall(LOGIN_FN_OPTS, async (request) => {
  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho not configured' };
  }

  const email = request.data?.email?.trim();
  const password = request.data?.password;
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'A valid password is required');
  }

  return zoho.provisionFromLoginCredentials(db, email, password);
});

exports.zohoDiagnoseIlUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho not configured' };
  }

  const email = request.data?.email?.trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  const result = await zoho.diagnoseIlUserLookup(email, request.data?.username, {
    phone: request.data?.phone,
    ilUserRecordId: request.data?.zohoIlUserId,
  });
  return { ok: Boolean(result.found), ...result };
});

// ── Lesson media — the only route to a lesson URL ─────────────
const lessonAssets = require('./lessonAssets');

/**
 * Hand back a lesson's media URL, but only to a learner entitled to it.
 *
 * The URLs used to ship inside the client bundle, so anyone who signed up could
 * read them out of the page and watch paid content without paying. Padlocks in
 * the UI cannot fix that — whatever the browser receives, the person holding
 * the browser can read. The fix is to never send it.
 *
 * Denials carry a reason so the app can say something true — "payment
 * required" and "your access has ended" are different situations and a learner
 * can act on the difference.
 */
exports.getLessonAsset = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const taskId = request.data?.taskId;
  if (!taskId) {
    throw new HttpsError('invalid-argument', 'taskId is required');
  }

  const snap = await db.collection('users').doc(request.auth.uid).get();
  const profile = snap.data() || {};

  /*
   * Two or three videos per programme are permanent and live in code; the rest
   * are recorded per batch and uploaded by the team, so the stored document is
   * consulted for this learner's cohort. Read with admin privileges on purpose:
   * the collection is closed to learners, because a readable list of URLs would
   * put us straight back where we started.
   */
  let media = null;
  for (const program of ['mbw', '100bm', 'lep']) {
    const docId = lessonAssets.lessonMediaDocId(program, taskId);
    // eslint-disable-next-line no-await-in-loop
    const mediaSnap = await db.collection(lessonAssets.LESSON_MEDIA).doc(docId).get();
    if (mediaSnap.exists) {
      media = mediaSnap.data();
      break;
    }
  }

  /*
   * A batch's own session recording, filed by CX against this lesson. It lives
   * in a subcollection learners cannot read — it used to be an array on the
   * batch document, which batch members can read, so an unpaid learner in the
   * cohort could take the links to every paid session in it.
   */
  if (!media || !media.byBatch?.[profile.batchName]) {
    const batchName = String(profile.batchName || '').trim();
    if (batchName) {
      const groups = await db
        .collection('groups')
        .where('name', '==', batchName)
        .limit(1)
        .get();
      if (!groups.empty) {
        const recSnap = await groups.docs[0].ref
          .collection('recordings')
          .doc(`session_${taskId}`)
          .get();
        const url = recSnap.exists ? recSnap.data()?.url : '';
        if (url) {
          media = { ...(media || {}), byBatch: { ...(media?.byBatch || {}), [batchName]: url } };
        }
      }
    }
  }

  const result = lessonAssets.resolveLessonAsset(profile, taskId, new Date(), media);

  if (!result.ok) {
    if (result.reason === 'not-found' || result.reason === 'missing-task-id') {
      throw new HttpsError('not-found', 'No media for this lesson');
    }
    // Logged so a wrongly denied learner can be traced without them having to
    // describe what they saw.
    console.info(`Lesson asset denied: ${request.auth.uid} ${taskId} — ${result.reason}`);
    throw new HttpsError('permission-denied', result.reason);
  }

  return { url: result.url, program: result.program };
});

exports.zohoLeadWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers['x-zoho-webhook-secret'] || req.headers['x-webhook-secret'];
    if (headerSecret !== secret) {
      res.status(401).json({ ok: false, reason: 'Unauthorized' });
      return;
    }
  }

  const body = parseWebhookBody(req);

  if (!zoho.isConfigured() && !hasWebhookCredentials(body)) {
    res.status(503).json({
      ok: false,
      reason:
        'Zoho OAuth not configured on Cloud Functions — deploy functions/.env secrets, or include email+password in webhook',
    });
    return;
  }

  try {
    const email = (body.email || body.Email || '').trim();

    if (!email) {
      res.status(400).json({
        ok: false,
        reason:
          'email is required — check Deluge POST body (form fields must reach zohoLeadWebhook)',
      });
      return;
    }

    /*
     * A Lead Status change posts mode=entitlements: refresh what the learner is
     * entitled to and nothing more. Full provisioning would refuse any status
     * that resolves to unpaid, so corrections and downgrades would apply
     * nothing, and it would create an account for a lead who is not a learner.
     */
    const entitlementsOnly = String(body.mode || '').toLowerCase() === 'entitlements';
    const result = entitlementsOnly
      ? await zoho.syncEntitlementsFromZoho(db, email, body)
      : await zoho.provisionFromRegistrationWebhook(db, body);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error('Zoho webhook provision failed:', err.message);
    res.status(500).json({ ok: false, reason: err.message });
  }
});

// ── Storage admin (super-admin only) ──────────────────────────
const storageAdmin = require('./storage');
const userAdmin = require('./userAdmin');

exports.storageGetOverview = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  return storageAdmin.getOverview(db);
});

exports.storageScanBucket = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  return storageAdmin.scanBucket(db);
});

exports.storageListObjects = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  return storageAdmin.listObjects(db, request.data || {});
});

exports.storageDeleteObjects = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  const { paths } = request.data || {};
  return storageAdmin.deleteObjects(db, paths);
});

exports.storageCleanOrphans = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  return storageAdmin.cleanOrphans(db);
});

exports.storageDeleteUserStorage = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  const { userId } = request.data || {};
  return storageAdmin.deleteUserStorage(db, userId);
});

exports.storageResetUserStorage = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await storageAdmin.assertSuperAdmin(db, request.auth.uid);
  const { userId } = request.data || {};
  return storageAdmin.resetUserStorage(db, userId);
});

exports.adminDeleteUser = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required');
  const { userId } = request.data || {};
  return userAdmin.deleteUserAccount(db, { callerUid: request.auth.uid, userId });
});
