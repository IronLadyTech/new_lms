/**
 * CMS "App payments": every balance paid in the app, and whether it reached Zoho.
 * CMS staff only. Names come with the last 4 digits of the mobile, nothing more.
 *
 * Zoho column:
 *   done       — Lead Status set (or already Started) and the Note added
 *   retrying   — the last try failed; the 30-minute job tries again (up to 10 times)
 *   attention  — 10 tries failed: CX check the Lead, then "Send to Zoho again"
 *   waiting    — not tried yet (payments from before the Zoho update existed)
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { assertCmsStaff } = require('./cmsBatchLearners');

const MAX_TRIES = 10;

function ms(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return Date.parse(v) || 0;
}

/** The Zoho state CX see. Pure. */
function zohoState(p) {
  if (p.zohoSyncedAt) return 'done';
  if (p.zohoError) return (p.zohoTries || 0) >= MAX_TRIES ? 'attention' : 'retrying';
  return 'waiting';
}

async function runCmsListAppPayments(db, request) {
  await assertCmsStaff(db, request.auth?.uid);
  const snap = await db.collection('razorpay_payments').orderBy('verifiedAt', 'desc').limit(300).get();
  const pays = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const uids = [...new Set(pays.map((p) => p.uid).filter(Boolean))];
  const users = {};
  for (let i = 0; i < uids.length; i += 100) {
    const got = await db.getAll(...uids.slice(i, i + 100).map((u) => db.collection('users').doc(u)));
    got.forEach((s) => s.exists && (users[s.id] = s.data() || {}));
  }
  const check = await db.collection('app_stats').doc('razorpayCheck').get();
  const c = check.exists ? check.data() : null;
  return {
    payments: pays.map((p) => {
      const u = users[p.uid] || {};
      return {
        paymentId: p.id,
        orderId: p.orderId || '',
        at: ms(p.verifiedAt),
        programId: p.programId || '',
        amount: Math.round(Number(p.amountPaise || 0) / 100),
        test: Boolean(p.testMode),
        source: p.source || '',
        name: String(u.displayName || u.name || u.email || 'Learner'),
        phone: String(u.phoneNumber || u.phone || '').replace(/\D/g, '').slice(-4),
        zoho: zohoState(p),
        zohoTo: p.zohoStatusTo || '',
        zohoFrom: p.zohoStatusFrom || '',
        zohoError: p.zohoError || '',
        zohoTries: p.zohoTries || 0,
        leadId: p.zohoLeadId || '',
      };
    }),
    lastCheck: c
      ? { at: ms(c.lastRunAt), checked: c.checked || 0, ours: c.ours || 0, recovered: (c.recovered || []).length, errors: c.errors || [] }
      : null,
  };
}

/** "Send to Zoho again" for one payment (also for 'done' ones: it is sent once more). */
async function runCmsRetryPaymentZoho(db, request, deps) {
  await assertCmsStaff(db, request.auth?.uid);
  const paymentId = String(request.data?.paymentId || '').trim();
  if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId is required');
  const ref = db.collection('razorpay_payments').doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such payment');
  const p = snap.data();
  await ref.set({ zohoSyncedAt: null, zohoTries: 0 }, { merge: true });
  const { syncPaymentToZoho } = require('./paymentZohoSync');
  const res = await syncPaymentToZoho(
    db,
    { uid: p.uid, programId: p.programId || 'lep', paymentId, orderId: p.orderId, amountPaise: p.amountPaise, testMode: Boolean(p.testMode) },
    deps
  );
  return res.ok ? { ok: true, to: res.to || '', from: res.from || '' } : { ok: false, reason: res.reason };
}

async function runCmsCheckRazorpayNow(db, request) {
  await assertCmsStaff(db, request.auth?.uid);
  const { reconcileRazorpayPayments } = require('./razorpayPayments');
  const res = await reconcileRazorpayPayments(db, { days: Number(request.data?.days) || 2 });
  return { ok: true, checked: res.checked, ours: res.ours, recovered: res.recovered.length, errors: res.errors };
}

module.exports = { runCmsListAppPayments, runCmsRetryPaymentZoho, runCmsCheckRazorpayNow, zohoState };
