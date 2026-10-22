/**
 * Staff-only test hook: deliver one CMS notification event to a learner (in-app + push).
 * Full scheduler will reuse deliverToUser() from this module later.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

function db() {
  return admin.firestore();
}

const STAFF_ROLES = new Set(['admin', 'superadmin', 'moderator', 'pl', 'cem']);

const PUSH_BRAND_IMAGE_URL =
  'https://lmsironlady-app.web.app/notification-logo.png';

async function callerIsStaff(uid) {
  if (!uid) return false;
  const snap = await db().collection('users').doc(uid).get();
  const role = snap.exists ? snap.data().role : '';
  return STAFF_ROLES.has(role);
}

async function loadEventByCode(code) {
  const q = await db().collection('cms_notificationEvents').where('code', '==', code).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, ...doc.data() };
}

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function writeInAppNotification(targetUid, payload) {
  const ref = db().collection('users').doc(targetUid).collection('notifications').doc();
  await ref.set({
    ...payload,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function sendPush(targetUid, { title, body, go, eventCode }) {
  const user = await db().collection('users').doc(targetUid).get();
  const token = user.exists ? user.data().fcmToken : null;
  if (!token) return { sent: false, reason: 'no_fcm_token' };

  const data = {
    eventCode: eventCode || '',
    go: JSON.stringify(go || { to: 'myProgram' }),
  };

  await admin.messaging().send({
    token,
    notification: {
      title,
      body,
      imageUrl: PUSH_BRAND_IMAGE_URL,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        icon: 'notification_icon',
        color: '#ED1D24',
        imageUrl: PUSH_BRAND_IMAGE_URL,
      },
    },
  });
  return { sent: true };
}

/** Invoked from index.js — lazy-required so deploy discovery stays under the 10s cap. */
exports.runSendParticipantNotificationTest = async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const staffOk = await callerIsStaff(request.auth.uid);
  if (!staffOk) throw new HttpsError('permission-denied', 'Staff only.');

  const { targetUid, eventCode, title, body, go } = request.data || {};
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  let event = null;
  if (eventCode) {
    event = await loadEventByCode(String(eventCode).trim());
    if (!event) throw new HttpsError('not-found', `No CMS event with code ${eventCode}.`);
  }

  const channels = event?.channels || { push: true, whatsapp: false, email: false };
  const vars = {
    name: 'there',
    session: 'Session',
    time: '',
    task: '',
    joinLink: '',
    score: '—',
  };
  const finalTitle = title || fillTemplate(event?.title || event?.name || 'Iron Lady', vars);
  const finalBody = body || fillTemplate(event?.body || '', vars);
  const finalGo = go || { to: 'myProgram' };

  const inAppPayload = {
    title: finalTitle,
    body: finalBody,
    meta: finalBody,
    kind: event?.priority === 'session' || event?.priority === 'mandatory' ? 'attention' : 'guide',
    icon: 'notifications',
    action: '',
    eventCode: event?.code || eventCode || 'TEST',
    go: finalGo,
    channels: { inApp: true, push: !!channels.push },
  };

  const notificationId = await writeInAppNotification(targetUid, inAppPayload);

  let pushResult = { sent: false, reason: 'push_disabled' };
  if (channels.push) {
    pushResult = await sendPush(targetUid, {
      title: finalTitle,
      body: finalBody,
      go: finalGo,
      eventCode: inAppPayload.eventCode,
    });
  }

  return {
    ok: true,
    notificationId,
    push: pushResult,
    eventCode: inAppPayload.eventCode,
  };
};
