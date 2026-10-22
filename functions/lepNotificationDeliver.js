/**
 * Shared delivery for LEP CMS notifications (in-app + FCM).
 * Copy to D:\LMS\new_lms\functions\lepNotificationDeliver.js
 * Used by sendParticipantNotificationTest and lepNotificationScheduler.
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const PUSH_BRAND_IMAGE_URL =
  'https://lmsironlady-app.web.app/notification-logo.png';

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function writeInAppNotification(db, targetUid, payload) {
  const ref = db.collection('users').doc(targetUid).collection('notifications').doc();
  await ref.set({
    ...payload,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function sendPush(db, targetUid, { title, body, go, eventCode }) {
  const user = await db.collection('users').doc(targetUid).get();
  const token = user.exists ? user.data().fcmToken : null;
  if (!token) return { sent: false, reason: 'no_fcm_token' };

  const data = {
    eventCode: eventCode || '',
    go: JSON.stringify(go || { to: 'myProgram' }),
  };

  await getMessaging().send({
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

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function deliverCmsEventToUser(db, targetUid, event, vars, overrides = {}) {
  const channels = event?.channels || { push: true, whatsapp: false, email: false };
  const finalTitle =
    overrides.title || fillTemplate(event?.title || event?.name || 'Iron Lady', vars);
  const finalBody = overrides.body || fillTemplate(event?.body || '', vars);
  const finalGo = overrides.go || { to: 'schedule' };

  const inAppPayload = {
    title: finalTitle,
    body: finalBody,
    meta: finalBody,
    kind: event?.priority === 'session' || event?.priority === 'mandatory' ? 'attention' : 'guide',
    icon: 'notifications',
    action: '',
    eventCode: event?.code || overrides.eventCode || 'CMS',
    go: finalGo,
    channels: { inApp: true, push: !!channels.push },
  };

  const notificationId = await writeInAppNotification(db, targetUid, inAppPayload);

  let pushResult = { sent: false, reason: 'push_disabled' };
  if (channels.push) {
    pushResult = await sendPush(db, targetUid, {
      title: finalTitle,
      body: finalBody,
      go: finalGo,
      eventCode: inAppPayload.eventCode,
    });
  }

  return { ok: true, notificationId, push: pushResult, eventCode: inAppPayload.eventCode };
}

module.exports = {
  deliverCmsEventToUser,
  fillTemplate,
};
