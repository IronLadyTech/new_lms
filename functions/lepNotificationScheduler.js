/**
 * LEP batch notification scheduler — session reminders (sessionStart / sessionEnd) and
 * clock-time reminders (day1 / daily / weekly, see lepTimeAnchors.js).
 *
 * Deploy on lmsironlady (D:\LMS\new_lms\functions):
 *
 *   const { onSchedule } = require('firebase-functions/v2/scheduler');
 *   const { runLepNotificationScheduler } = require('./lepNotificationScheduler');
 *   exports.lepNotificationScheduler = onSchedule(
 *     { schedule: 'every 15 minutes', timeZone: 'Asia/Kolkata', region: 'us-central1' },
 *     runLepNotificationScheduler
 *   );
 *
 * Requires: cms_batches (live + automationEnabled), cms_notificationEvents,
 * learners via groups/{lmsGroupId}.memberIds or users.programAccess.lep.batchId, cms_notification_sends dedupe.
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { deliverCmsEventToUser } = require('./lepNotificationDeliver');
const { autoStartReadyBatches } = require('./batchAutoStart');
const { sessionAnchorFires } = require('./lepNotificationAnchors');
const { timeAnchorFires } = require('./lepTimeAnchors');
const { doneTaskIds, messageForLearner, taskReminderFires, taskReminderKind } = require('./lepTaskReminders');
const {
  TIME_ANCHOR_VARS,
  fillableWith,
  finishText,
  reachesLearner,
  reachesLearnerOnDay,
  sendableNow,
} = require('./lepReminderRules');
const { inAudience } = require('./learnerSegments');
const { learnersForBatch } = require('./cmsBatchLearners');

const WINDOW_MS = 15 * 60 * 1000;

async function loadLiveBatches(db) {
  const snap = await db.collection('cms_batches').where('status', '==', 'live').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.automationEnabled === true && Array.isArray(b.sessions) && b.sessions.length);
}

async function loadParticipantEvents(db) {
  const snap = await db.collection('cms_notificationEvents').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => {
      const r = e.recipients || ['participant'];
      return r.includes('participant') && e.active !== false;
    });
}

async function alreadySent(db, dedupeKey) {
  const ref = db.collection('cms_notification_sends').doc(dedupeKey.replace(/\//g, '_'));
  const snap = await ref.get();
  return snap.exists;
}

async function markSent(db, dedupeKey, meta) {
  const ref = db.collection('cms_notification_sends').doc(dedupeKey.replace(/\//g, '_'));
  await ref.set({ ...meta, createdAt: FieldValue.serverTimestamp() });
}

/** Same learners the CMS counts: LMS batch members plus anyone who picked the batch in the app. */
function participantsForBatch(db, batch) {
  return learnersForBatch(db, batch);
}

/**
 * Messages CX scheduled for one batch (cms_batch_messages). Sent once, to the
 * chosen audience only (everyone / part paid / full paid / late joiners), any program.
 */
async function deliverDueBatchMessages(db, nowMs) {
  const snap = await db
    .collection('cms_batch_messages')
    .where('status', '==', 'scheduled')
    .limit(50)
    .get();
  let sent = 0;
  for (const doc of snap.docs) {
    const msg = doc.data();
    const sendAtMs = Date.parse(msg.sendAt || '');
    if (!Number.isFinite(sendAtMs) || sendAtMs > nowMs) continue;

    // Claim it first, so a second scheduler run can never send it twice.
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== 'scheduled') return false;
      tx.update(doc.ref, { status: 'sending', claimedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) continue;

    const batchSnap = await db
      .collection('cms_batches')
      .doc(String(msg.batchId || ''))
      .get();
    if (!batchSnap.exists) {
      await doc.ref.update({ status: 'failed', error: 'Batch not found' });
      continue;
    }
    const batch = { id: batchSnap.id, ...batchSnap.data() };
    const learners = await learnersForBatch(db, batch);
    let recipients = 0;
    for (const { uid, data } of learners) {
      if (!inAudience(msg.audience, data, batch)) continue;
      const name = data.displayName || data.firstName || data.name;
      const vars = { name: name ? String(name).split(' ')[0] : 'there' };
      await deliverCmsEventToUser(
        db,
        uid,
        { code: 'CX-MESSAGE', title: msg.title, body: msg.body, channels: { push: true } },
        vars,
        { title: finishText(msg.title, vars), body: finishText(msg.body, vars), go: { to: 'home' } }
      );
      recipients += 1;
    }
    await doc.ref.update({
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      recipientCount: recipients,
    });
    sent += 1;
  }
  return sent;
}

async function runLepNotificationScheduler() {
  const db = getFirestore();
  const now = Date.now();
  const windowStartMs = now - WINDOW_MS;
  const windowEndMs = now;

  const customSent = await deliverDueBatchMessages(db, now);

  // Ready batches switch their reminders on by themselves (batchAutoStart.js); CX no
  // longer has to press Start on each one. A batch CX paused is left alone.
  await autoStartReadyBatches(db, now).catch((e) =>
    console.error('[lepNotificationScheduler] auto-start:', e?.message || e)
  );

  const batches = await loadLiveBatches(db);
  const events = await loadParticipantEvents(db);
  // Conditional messages (attended / absent / task not done) wait for attendance data.
  const sessionEvents = events.filter(
    (e) => (e.anchor?.type === 'sessionStart' || e.anchor?.type === 'sessionEnd') && sendableNow(e)
  );
  // Clock-time rules whose text needs only name / batch / date (score, task lists wait for data).
  const timeEvents = events.filter(
    (e) =>
      ['day1', 'daily', 'weekly'].includes(e.anchor?.type) &&
      sendableNow(e) &&
      fillableWith(e, TIME_ANCHOR_VARS)
  );
  // Task open / due / overdue (lepTaskReminders) — "only if not done" is checked per learner there.
  const taskEvents = events.filter((e) => taskReminderKind(e));

  let delivered = 0;
  let skipped = 0;

  for (const batch of batches) {
    const learners = await participantsForBatch(db, batch);
    if (!learners.length) continue;
    // Her handed-in LEP tasks, loaded once per run and only if a due / overdue fire needs them.
    const doneByUid = new Map();
    const doneFor = async (uid) => {
      if (!doneByUid.has(uid)) {
        const snap = await db.collection('lep_submissions').where('userId', '==', uid).get();
        doneByUid.set(uid, doneTaskIds(snap.docs.map((d) => d.data())));
      }
      return doneByUid.get(uid);
    };

    for (const event of sessionEvents) {
      const fires = sessionAnchorFires(batch, event, windowStartMs, windowEndMs);
      for (const fire of fires) {
        if (await alreadySent(db, fire.dedupeKey)) {
          skipped += 1;
          continue;
        }
        let recipients = 0;
        for (const { uid, data } of learners) {
          // Part-paid learners only hear about the sessions open to them.
          if (!reachesLearner(fire.session, data.programAccess?.lep?.paymentStatus)) continue;
          const name = data.displayName || data.firstName || data.name;
          const vars = { ...fire.vars, name: name ? String(name).split(' ')[0] : 'there' };
          await deliverCmsEventToUser(db, uid, fire.event, vars, {
            title: finishText(fire.event.title || fire.event.name || 'Iron Lady', vars),
            body: finishText(fire.event.body, vars),
            go: { to: 'schedule' },
          });
          delivered += 1;
          recipients += 1;
        }
        await markSent(db, fire.dedupeKey, {
          batchId: batch.id,
          eventCode: event.code,
          sessionCode: fire.session.code,
          fireAtMs: fire.fireAtMs,
          recipientCount: recipients,
        });
      }
    }

    for (const event of timeEvents) {
      for (const fire of timeAnchorFires(batch, event, windowStartMs, windowEndMs)) {
        if (await alreadySent(db, fire.dedupeKey)) {
          skipped += 1;
          continue;
        }
        let recipients = 0;
        for (const { uid, data } of learners) {
          if (!reachesLearnerOnDay(fire.offset, data.programAccess?.lep?.paymentStatus)) continue;
          const name = data.displayName || data.firstName || data.name;
          const vars = { ...fire.vars, name: name ? String(name).split(' ')[0] : 'there' };
          await deliverCmsEventToUser(db, uid, fire.event, vars, {
            title: finishText(fire.event.title || fire.event.name || 'Iron Lady', vars),
            body: finishText(fire.event.body, vars),
            go: { to: 'home' },
          });
          delivered += 1;
          recipients += 1;
        }
        await markSent(db, fire.dedupeKey, {
          batchId: batch.id,
          eventCode: event.code,
          day: fire.day,
          fireAtMs: fire.fireAtMs,
          recipientCount: recipients,
        });
      }
    }

    for (const event of taskEvents) {
      for (const fire of taskReminderFires(batch, event, windowStartMs, windowEndMs)) {
        if (await alreadySent(db, fire.dedupeKey)) {
          skipped += 1;
          continue;
        }
        let recipients = 0;
        for (const { uid, data } of learners) {
          const name = data.displayName || data.firstName || data.name;
          const msg = messageForLearner(fire, event, {
            paymentStatus: data.programAccess?.lep?.paymentStatus,
            doneIds: fire.kind === 'open' ? new Set() : await doneFor(uid),
            name: name ? String(name).split(' ')[0] : 'there',
          });
          if (!msg) continue;
          await deliverCmsEventToUser(db, uid, event, {}, msg);
          delivered += 1;
          recipients += 1;
        }
        await markSent(db, fire.dedupeKey, {
          batchId: batch.id,
          eventCode: event.code,
          day: fire.day,
          tasks: fire.tasks.map((t) => t.id),
          fireAtMs: fire.fireAtMs,
          recipientCount: recipients,
        });
      }
    }
  }

  console.log('lepNotificationScheduler', {
    delivered,
    skipped,
    customSent,
    batches: batches.length,
  });
  return { delivered, skipped };
}

module.exports = { runLepNotificationScheduler };
