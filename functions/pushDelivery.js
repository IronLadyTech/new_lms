/**
 * Push to every device a learner is signed in on.
 *
 * Devices (users/{uid}/devices/{installId}, written by app-new services/pushNotifications.js):
 *   { platform: 'android'|'ios', nativeToken, expoToken, appVersion, updatedAt }
 * Route per device:
 *   android → FCM with nativeToken (unchanged from before; works without Expo credentials)
 *   ios     → Expo push with expoToken (APNs via Expo — a JS app has no FCM token on iOS)
 * Set PUSH_ANDROID_VIA_EXPO=1 once the FCM key is uploaded to Expo to move Android too.
 *
 * users.fcmToken (older builds, and the web LMS senders in index.js) is still sent to,
 * unless one of her devices carries that same token — so nothing arrives twice.
 * Dead tokens are removed, so a reinstalled phone stops costing a send.
 */
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const DEAD_FCM = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** Where this user's pushes go: [{ via: 'fcm'|'expo', token, deviceRef? , legacy? }] */
async function pushTargets(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const [user, devices] = await Promise.all([userRef.get(), userRef.collection('devices').get()]);
  const androidViaExpo = process.env.PUSH_ANDROID_VIA_EXPO === '1';
  const targets = [];
  const nativeSeen = new Set();
  for (const d of devices.docs) {
    const dev = d.data();
    if (dev.nativeToken) nativeSeen.add(dev.nativeToken);
    if (dev.platform === 'ios' || (androidViaExpo && dev.expoToken)) {
      if (dev.expoToken)
        targets.push({ via: 'expo', token: dev.expoToken, deviceRef: d.ref, channels: dev.channels });
    } else if (dev.nativeToken) {
      targets.push({ via: 'fcm', token: dev.nativeToken, deviceRef: d.ref, channels: dev.channels });
    }
  }
  const legacy = user.exists ? user.data().fcmToken : null;
  if (legacy && !nativeSeen.has(legacy)) targets.push({ via: 'fcm', token: legacy, legacy: true, userRef });
  return targets;
}

async function forget(target) {
  if (target.deviceRef) await target.deviceRef.delete().catch(() => {});
  if (target.legacy) await target.userRef.update({ fcmToken: null }).catch(() => {});
}

/**
 * The Android channel for this phone. A channel other than 'default' is used only when the
 * app on that phone created it (its device row lists it). A push to a channel the phone
 * does not have lands in Android's fallback channel, so older apps get 'default' instead.
 */
function channelFor(target, wanted) {
  if (!wanted || wanted === 'default') return 'default';
  return Array.isArray(target?.channels) && target.channels.includes(wanted) ? wanted : 'default';
}

function fcmMessage(token, { title, body, data, imageUrl, channelId = 'default' }) {
  return {
    token,
    notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId,
        icon: 'notification_icon',
        color: '#ED1D24',
        ...(imageUrl ? { imageUrl } : {}),
      },
    },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

async function sendExpo(messages, fetchImpl) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const res = await fetchImpl(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Expo push HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json.data || [];
}

/**
 * @param {{ title: string, body: string, data?: Record<string,string>, imageUrl?: string, channelId?: string }} msg
 *   data values must be strings (FCM); `go` is passed as JSON text, which the app parses.
 * @param deps  { messaging, fetch } — real services by default; tests pass stand-ins.
 * @returns {{ sent: boolean, devices: number, delivered: number, failed: number, reason?: string }}
 */
async function sendPushToUser(uid, msg, db = getFirestore(), deps = {}) {
  const messaging = deps.messaging || getMessaging();
  const fetchImpl = deps.fetch || fetch;
  const targets = await pushTargets(db, uid);
  if (!targets.length) return { sent: false, devices: 0, delivered: 0, failed: 0, reason: 'no_device' };

  let delivered = 0;
  let failed = 0;
  for (const t of targets.filter((x) => x.via === 'fcm')) {
    try {
      await messaging.send(fcmMessage(t.token, { ...msg, channelId: channelFor(t, msg.channelId) }));
      delivered += 1;
    } catch (err) {
      failed += 1;
      if (DEAD_FCM.has(err?.code)) await forget(t);
      else console.error(`[push] FCM ${uid}:`, err?.code || err?.message);
    }
  }

  const expo = targets.filter((x) => x.via === 'expo');
  if (expo.length) {
    try {
      const tickets = await sendExpo(
        expo.map((t) => ({
          to: t.token,
          title: msg.title,
          body: msg.body,
          data: msg.data || {},
          sound: 'default',
          priority: 'high',
          channelId: channelFor(t, msg.channelId),
        })),
        fetchImpl
      );
      for (let i = 0; i < expo.length; i += 1) {
        const ticket = tickets[i] || {};
        if (ticket.status === 'ok') delivered += 1;
        else {
          failed += 1;
          if (ticket.details?.error === 'DeviceNotRegistered') await forget(expo[i]);
          else console.error(`[push] Expo ${uid}:`, ticket.details?.error || ticket.message);
        }
      }
    } catch (err) {
      failed += expo.length;
      console.error(`[push] Expo ${uid}:`, err?.message);
    }
  }

  return { sent: delivered > 0, devices: targets.length, delivered, failed };
}

module.exports = { sendPushToUser, pushTargets, fcmMessage };
