/**
 * IL LMS — Firebase Cloud Functions
 *
 * SETUP:
 *   1. cd functions && npm install
 *   2. Zoho CRM secrets:
 *        firebase functions:secrets:set ZOHO_CLIENT_ID
 *        firebase functions:secrets:set ZOHO_CLIENT_SECRET
 *        firebase functions:secrets:set ZOHO_REFRESH_TOKEN
 *      Optional env (defaults shown):
 *        ZOHO_API_DOMAIN=https://www.zohoapis.com
 *        ZOHO_CRM_MODULE=Contacts
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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const zoho = require('./zoho');

admin.initializeApp();
const db = admin.firestore();

const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

// ── Helpers ───────────────────────────────────────────────────
function currentWeekLabel() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week  = Math.ceil(((now - start) / 86_400_000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function getRecurringPostTaskIds() {
  const snap = await db.collection('mbw_tasks')
    .where('type', 'in', ['recurring_post'])
    .get();
  return snap.docs.map((d) => d.id);
}

async function getUsersNeedingReminder(taskIds, weekLabel) {
  // Find all users who have a recurring_post submission but haven't posted this week
  const usersSnap = await db.collection('users').get();
  const pending   = [];

  for (const userDoc of usersSnap.docs) {
    const user = { id: userDoc.id, ...userDoc.data() };
    for (const taskId of taskIds) {
      const subId  = `${user.id}_${taskId}`;
      const subDoc = await db.collection('mbw_submissions').doc(subId).get();
      if (!subDoc.exists) {
        // Never submitted — eligible for reminder
        pending.push({ user, taskId });
        continue;
      }
      const sub     = subDoc.data();
      const entries = sub.weekEntries ?? [];
      const posted  = entries.some((e) => e.weekLabel === weekLabel);
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
      host:   SMTP_HOST.value(),
      port:   587,
      secure: false,
      auth:   { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });

    const taskIds = await getRecurringPostTaskIds();
    if (taskIds.length === 0) { console.log('No recurring post tasks found.'); return; }

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

// ── Zoho CRM — auto-sync on user profile changes ──────────────
exports.onUserProfileZohoSync = onDocumentWritten(
  { document: 'users/{userId}' },
  async (event) => {
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
  }
);

// ── Zoho CRM — activity notes on new LMS activities ───────────
exports.onActivityZohoNote = onDocumentCreated(
  { document: 'activities/{activityId}' },
  async (event) => {
    if (!zoho.isConfigured()) return;

    const activity = event.data?.data();
    if (!activity?.userId) return;

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

// ── Zoho CRM — admin: sync all users ──────────────────────────
exports.zohoSyncAllUsers = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  await zoho.assertAdmin(db, request.auth.uid);

  if (!zoho.isConfigured()) {
    return { ok: false, reason: 'Zoho secrets are not configured' };
  }

  const snap = await db.collection('users').get();
  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const doc of snap.docs) {
    const profile = doc.data();
    if (!profile.email) continue;
    try {
      const result = await zoho.syncUserToZoho(db, doc.id, profile);
      if (result.synced) synced += 1;
      else {
        failed += 1;
        if (errors.length < 5) errors.push(`${profile.email}: ${result.reason}`);
      }
    } catch (err) {
      failed += 1;
      if (errors.length < 5) errors.push(`${profile.email}: ${err.message}`);
    }
  }

  return { ok: true, total: snap.size, synced, failed, errors };
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

  const result = await zoho.syncUserToZoho(db, userId, snap.data());
  return { ok: result.synced, ...result };
});
