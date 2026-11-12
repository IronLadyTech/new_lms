/**
 * Razorpay — programme balance payments from the mobile app.
 *
 * Secrets (production):
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 */
const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  PAYMENT_STATUS,
  normalizePaymentStatus,
  accessTierFromPaymentStatus,
  maxPaymentStatus,
} = require('./accessTiers');

const { syncPaymentToZoho } = require('./paymentZohoSync');

const ORDERS = 'razorpay_orders';
const PAYMENTS = 'razorpay_payments';

function getKeys(keyId, keySecret) {
  const id = keyId || process.env.RAZORPAY_KEY_ID || '';
  const secret = keySecret || process.env.RAZORPAY_KEY_SECRET || '';
  if (!id || !secret) {
    throw new HttpsError(
      'failed-precondition',
      'Razorpay is not configured on the server yet.'
    );
  }
  return { keyId: id, keySecret: secret };
}

/**
 * Test payments for chosen accounts only. With RAZORPAY_TEST_KEY_ID (rzp_test_…) and
 * RAZORPAY_TEST_KEY_SECRET in functions/.env, the accounts listed in RAZORPAY_TEST_USERS
 * (comma separated: emails or 10-digit mobiles) pay through Razorpay test mode — no money
 * moves — while every other learner keeps the live keys. The order remembers its mode, so
 * the payment is checked with the matching secret.
 */
function testKeys(env = process.env) {
  const keyId = String(env.RAZORPAY_TEST_KEY_ID || '').trim();
  const keySecret = String(env.RAZORPAY_TEST_KEY_SECRET || '').trim();
  return keyId.startsWith('rzp_test_') && keySecret ? { keyId, keySecret } : null;
}

function isTestAccount(profile, env = process.env) {
  const list = String(env.RAZORPAY_TEST_USERS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length || !testKeys(env)) return false;
  const email = String(profile?.email || '').trim().toLowerCase();
  const phone = String(profile?.phoneNumber || profile?.phone || '').replace(/\D/g, '').slice(-10);
  return list.some((x) => (x.includes('@') ? x === email : x.replace(/\D/g, '').slice(-10) === phone && phone.length === 10));
}

function razorpayClient(keyId, keySecret) {
  const Razorpay = require('razorpay');
  const keys = getKeys(keyId, keySecret);
  return new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
}

function programTitle(programId) {
  const map = {
    lep: 'Leadership Essentials Program',
    '100bm': '100 Board Members',
    mbw: 'Master of Business Warfare',
  };
  return map[programId] || programId;
}

function resolveBalancePaise(profile, programId) {
  const access = profile?.programAccess?.[programId] || {};
  const balance =
    access.programBalance ??
    access.balanceDue ??
    access.balanceAmount ??
    profile?.programBalance ??
    null;

  if (balance != null && Number(balance) > 0) {
    return Math.round(Number(balance) * 100);
  }

  // Demo / staging fallback — replace when Zoho writes real balance on profile.
  const fallback = Number(process.env.RAZORPAY_DEFAULT_BALANCE_PAISE || 0);
  if (fallback > 0) return fallback;

  throw new HttpsError(
    'failed-precondition',
    'Programme balance amount is not set on your profile yet. Contact Iron Lady support.'
  );
}

async function createOrder(request, db, keyId, keySecret) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const uid = request.auth.uid;
  const { programId = 'lep' } = request.data || {};
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'User profile not found');
  }

  const profile = userSnap.data();
  const payStatus = normalizePaymentStatus(
    profile?.programAccess?.[programId]?.paymentStatus || profile?.paymentStatus
  );
  if (payStatus === PAYMENT_STATUS.PAID) {
    throw new HttpsError('failed-precondition', 'This programme is already fully paid.');
  }

  const amountPaise = resolveBalancePaise(profile, programId);
  const testMode = isTestAccount(profile);
  const keys = testMode ? testKeys() : getKeys(keyId, keySecret);
  const instance = razorpayClient(keys.keyId, keys.keySecret);
  const receipt = `${uid.slice(0, 8)}_${programId}_${Date.now()}`;

  const order = await instance.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: {
      uid,
      programId,
      email: profile.email || '',
    },
  });

  await db.collection(ORDERS).doc(order.id).set({
    orderId: order.id,
    uid,
    programId,
    amountPaise,
    currency: 'INR',
    receipt,
    status: 'created',
    createdAt: new Date(),
    ...(testMode ? { testMode: true } : {}),
  });

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: keys.keyId,
    description: `${programTitle(programId)} — programme balance${testMode ? ' (TEST, no money)' : ''}`,
    testMode,
    name: 'Iron Lady',
    prefill: {
      name: profile.displayName || '',
      email: profile.email || request.auth.token?.email || '',
      contact: profile.phoneNumber || profile.phone || '',
    },
    theme: { color: '#E8272A' },
  };
}

function verifySignature(orderId, paymentId, signature, keySecret) {
  const secret = keySecret || process.env.RAZORPAY_KEY_SECRET || '';
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

async function markProgrammePaid(db, uid, programId, paymentMeta) {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const profile = snap.data() || {};

  const updates = {
    updatedAt: new Date(),
    [`programAccess.${programId}.paymentStatus`]: PAYMENT_STATUS.PAID,
    [`programAccess.${programId}.fullPaidAt`]: new Date(),
    [`programAccess.${programId}.razorpayPaymentId`]: paymentMeta.paymentId,
    [`programAccess.${programId}.razorpayOrderId`]: paymentMeta.orderId,
  };

  const previous = profile.programAccess?.[programId]?.paymentStatus;
  const merged = maxPaymentStatus(previous, PAYMENT_STATUS.PAID);
  updates[`programAccess.${programId}.paymentStatus`] = merged;
  updates.paymentStatus = maxPaymentStatus(profile.paymentStatus, PAYMENT_STATUS.PAID);
  updates.accessTier = accessTierFromPaymentStatus(updates.paymentStatus);

  await userRef.update(updates);
}

async function verifyPayment(request, db, keyId, keySecret) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const uid = request.auth.uid;
  const { orderId, paymentId, signature, programId = 'lep' } = request.data || {};
  if (!orderId || !paymentId || !signature) {
    throw new HttpsError('invalid-argument', 'orderId, paymentId and signature are required');
  }

  const orderRef = db.collection(ORDERS).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Order not found');
  }
  const order = orderSnap.data();
  if (order.uid !== uid) {
    throw new HttpsError('permission-denied', 'Order does not belong to this user');
  }
  // A test-mode order is signed with the test secret.
  const secret = order.testMode ? testKeys()?.keySecret : getKeys(keyId, keySecret).keySecret;
  if (!secret || !verifySignature(orderId, paymentId, signature, secret)) {
    throw new HttpsError('permission-denied', 'Payment verification failed');
  }

  await orderRef.update({
    status: 'paid',
    paymentId,
    paidAt: new Date(),
  });

  await db.collection(PAYMENTS).doc(paymentId).set({
    paymentId,
    orderId,
    uid,
    programId: order.programId || programId,
    amountPaise: order.amountPaise,
    verifiedAt: new Date(),
    source: 'app',
    ...(order.testMode ? { testMode: true } : {}),
  });

  await markProgrammePaid(db, uid, order.programId || programId, {
    paymentId,
    orderId,
  });
  // Zoho: Lead Status Enrolled → Started, and a Note with the payment for CX.
  await syncPaymentToZoho(db, {
    uid,
    programId: order.programId || programId,
    paymentId,
    orderId,
    amountPaise: order.amountPaise,
    testMode: Boolean(order.testMode),
  });

  return { ok: true, paymentId, orderId, programId: order.programId || programId };
}

function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

/**
 * A payment Razorpay captured for one of our orders, recorded the way the app does it:
 * order paid, payment saved, programme unlocked, Zoho updated. Used by the webhook and by
 * the daily check against Razorpay (a learner whose app closed before it confirmed).
 */
async function recordPaidPayment(db, orderSnap, payment, source) {
  const order = orderSnap.data();
  await orderSnap.ref.set(
    { status: 'paid', paymentId: payment.id, paidAt: new Date(), ...(source === 'webhook' ? { webhook: true } : { recoveredBy: source }) },
    { merge: true }
  );
  await db.collection(PAYMENTS).doc(payment.id).set(
    {
      paymentId: payment.id,
      orderId: payment.order_id,
      uid: order.uid,
      programId: order.programId,
      amountPaise: payment.amount,
      verifiedAt: new Date(),
      source,
      ...(order.testMode ? { testMode: true } : {}),
    },
    { merge: true }
  );
  await markProgrammePaid(db, order.uid, order.programId, { paymentId: payment.id, orderId: payment.order_id });
  await syncPaymentToZoho(db, {
    uid: order.uid,
    programId: order.programId,
    paymentId: payment.id,
    orderId: payment.order_id,
    amountPaise: payment.amount,
    testMode: Boolean(order.testMode),
  });
}

/** Razorpay payments created between two times (unix seconds), all pages. */
async function fetchRazorpayPayments(keys, from, to) {
  const instance = razorpayClient(keys.keyId, keys.keySecret);
  const out = [];
  for (let skip = 0; skip < 2000; skip += 100) {
    const page = await instance.payments.all({ from, to, count: 100, skip });
    const items = page?.items || [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

/**
 * Daily safety net: every payment Razorpay captured in the last `days` days for one of our
 * orders must be in razorpay_payments. Anything missing (the app closed before it confirmed,
 * no webhook) is recorded now. Payments for orders that are not ours (website, other tools on
 * the same Razorpay account) are left alone. Live keys always; test keys when configured.
 * @param deps.listPayments(mode, from, to) — for tests; defaults to the Razorpay API.
 */
async function reconcileRazorpayPayments(db, { days = 2 } = {}, deps = {}) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.max(1, Math.min(30, Number(days) || 2)) * 86400;
  const modes = [];
  const live = (() => {
    try {
      return getKeys();
    } catch {
      return null;
    }
  })();
  if (live) modes.push(['live', live]);
  if (testKeys()) modes.push(['test', testKeys()]);
  const list = deps.listPayments || ((mode, f, t) => fetchRazorpayPayments(modes.find((m) => m[0] === mode)[1], f, t));
  const summary = { checked: 0, ours: 0, recovered: [], errors: [] };
  for (const [mode] of deps.modes ? deps.modes.map((m) => [m]) : modes) {
    let items = [];
    try {
      items = await list(mode, from, to);
    } catch (e) {
      summary.errors.push(`${mode}: ${String(e?.error?.description || e?.message || e).slice(0, 160)}`);
      continue;
    }
    for (const p of items) {
      summary.checked += 1;
      if (p.status !== 'captured' || !p.order_id) continue;
      const orderSnap = await db.collection(ORDERS).doc(p.order_id).get();
      if (!orderSnap.exists) continue; // not an app order
      summary.ours += 1;
      const known = await db.collection(PAYMENTS).doc(p.id).get();
      if (known.exists) continue;
      await recordPaidPayment(db, orderSnap, p, 'razorpay-check');
      summary.recovered.push({ paymentId: p.id, uid: orderSnap.data().uid, mode });
    }
  }
  await db
    .collection('app_stats')
    .doc('razorpayCheck')
    .set({ lastRunAt: new Date(), days, ...summary, recovered: summary.recovered.slice(0, 50) }, { merge: false })
    .catch(() => {});
  return summary;
}

async function handleWebhook(req, db, keySecret, webhookSecret) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody =
    req.rawBody?.toString?.('utf8') ||
    (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return { status: 401, body: 'Invalid signature' };
  }

  const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  const event = payload?.event;
  const payment = payload?.payload?.payment?.entity;

  if (event === 'payment.captured' && payment?.id && payment?.order_id) {
    const orderSnap = await db.collection(ORDERS).doc(payment.order_id).get();
    if (orderSnap.exists && orderSnap.data().status !== 'paid') {
      await recordPaidPayment(db, orderSnap, payment, 'webhook');
    }
  }

  return { status: 200, body: 'ok' };
}

module.exports = {
  createOrder,
  verifyPayment,
  isTestAccount,
  testKeys,
  recordPaidPayment,
  reconcileRazorpayPayments,
  handleWebhook,
};
