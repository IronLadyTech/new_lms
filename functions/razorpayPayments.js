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
  const keys = getKeys(keyId, keySecret);
  const instance = razorpayClient(keyId, keySecret);
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
  });

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: keys.keyId,
    description: `${programTitle(programId)} — programme balance`,
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

  if (!verifySignature(orderId, paymentId, signature, keySecret)) {
    throw new HttpsError('permission-denied', 'Payment verification failed');
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
  });

  await markProgrammePaid(db, uid, order.programId || programId, {
    paymentId,
    orderId,
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
      const order = orderSnap.data();
      await orderSnap.ref.update({
        status: 'paid',
        paymentId: payment.id,
        paidAt: new Date(),
        webhook: true,
      });
      await db.collection(PAYMENTS).doc(payment.id).set({
        paymentId: payment.id,
        orderId: payment.order_id,
        uid: order.uid,
        programId: order.programId,
        amountPaise: payment.amount,
        verifiedAt: new Date(),
        source: 'webhook',
      });
      await markProgrammePaid(db, order.uid, order.programId, {
        paymentId: payment.id,
        orderId: payment.order_id,
      });
    }
  }

  return { status: 200, body: 'ok' };
}

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
};
