/**
 * A balance paid in the app reaches Zoho at once.
 *
 * Zoho's Lead Status is where CX record what somebody paid for, and the LMS reads access from
 * it: "<Program> Enrolled" is registered (part paid), "<Program> Started" is paid in full
 * (zohoFieldMap). So when a learner pays her balance in the app, her Lead moves from
 * "LEP Enrolled" to "LEP Started" (100BM: "100 BM started", MBW: "MBW started") and a Note
 * records the amount, the Razorpay ids and the date for CX.
 *
 * Only forward: a Lead already Started or Completed for that programme, or in a refund, keeps
 * its status (the Note is still added). Each payment is sent once (razorpay_payments
 * zohoSyncedAt), however many times Razorpay and the app both report it.
 */
const STARTED = { lep: 'LEP Started', '100bm': '100 BM started', mbw: 'MBW started' };
const PROGRAM = { lep: /^lep\b/i, '100bm': /^100\s*bm\b/i, mbw: /^mbw\b/i };
const TITLE = { lep: 'LEP', '100bm': '100BM', mbw: 'MBW' };

/** The Lead Status after a full payment, or null to leave it as it is. Pure. */
function paidLeadStatus(programId, current) {
  const target = STARTED[programId];
  if (!target) return null;
  const s = String(current || '').trim();
  if (/refund/i.test(s)) return null;
  if (PROGRAM[programId].test(s) && /(start|complete)/i.test(s)) return null;
  return target;
}

function rupees(paise) {
  const n = Math.round(Number(paise || 0) / 100);
  return n > 0 ? `₹${n.toLocaleString('en-IN')}` : 'an amount';
}

function istStamp(d) {
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ') + ' IST';
}

/** The Note CX read on the Lead. Pure. */
function paymentNote({ programId, amountPaise, paymentId, orderId, from, to, at, testMode }) {
  const program = TITLE[programId] || programId;
  return {
    title: `${testMode ? 'TEST payment (no money): ' : 'Paid in the app: '}${program} ${rupees(amountPaise)}`,
    content: [
      ...(testMode ? ['TEST: Razorpay test mode, no money was received. Change the Lead Status back if needed.'] : []),
      `${program} balance of ${rupees(amountPaise)} paid in the Iron Lady app on ${istStamp(at)}.`,
      `Razorpay payment ${paymentId}, order ${orderId}.`,
      to ? `Lead Status changed from "${from || '-'}" to "${to}" by the app.` : `Lead Status left as "${from || '-'}".`,
    ].join('\n'),
  };
}

function defaultDeps() {
  const zoho = require('./zoho');
  if (!zoho.isConfigured()) return null;
  return zoho.paymentSyncDeps();
}

/**
 * @param payment { uid, programId, paymentId, orderId, amountPaise }
 * @param deps { findLeadId(profile), getLeadById, updateLead(id, fields), addNote(id, title, content) }
 */
async function syncPaymentToZoho(db, payment, deps = defaultDeps()) {
  if (!deps) return { ok: false, reason: 'zoho-not-configured' };
  const { uid, programId, paymentId } = payment;
  const ref = db.collection('razorpay_payments').doc(paymentId);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.zohoSyncedAt) return { ok: true, already: true };
  try {
    const profile = { uid, ...((await db.collection('users').doc(uid).get()).data() || {}) };
    const leadId = await deps.findLeadId(profile);
    if (!leadId) throw new Error('No Zoho Lead for this learner (email or mobile)');
    const lead = await deps.getLeadById(leadId);
    const from = lead?.Lead_Status || '';
    const to = paidLeadStatus(programId, from);
    if (to) await deps.updateLead(leadId, { Lead_Status: to });
    const note = paymentNote({ ...payment, from, to, at: new Date() });
    await deps.addNote(leadId, note.title, note.content).catch((e) => console.warn('payment note failed', e.message));
    await ref.set(
      { zohoSyncedAt: new Date(), zohoLeadId: String(leadId), zohoStatusFrom: from || null, zohoStatusTo: to || null, zohoError: null },
      { merge: true }
    );
    return { ok: true, leadId: String(leadId), from, to };
  } catch (err) {
    const message = String(err?.message || err).slice(0, 300);
    console.error(`Payment ${paymentId} → Zoho failed:`, message);
    await ref.set({ zohoError: message, zohoTriedAt: new Date() }, { merge: true }).catch(() => {});
    return { ok: false, reason: message };
  }
}

/**
 * Payments whose Zoho update failed (Zoho down, Lead not found yet …) are tried again, up to
 * 10 times, by a schedule. The payment itself always stands; only the Zoho copy is retried.
 */
async function retryFailedPaymentSyncs(db, deps = defaultDeps(), limit = 20) {
  if (!deps) return { tried: 0 };
  const snap = await db.collection('razorpay_payments').where('zohoError', '!=', null).limit(limit).get();
  let tried = 0;
  let fixed = 0;
  for (const doc of snap.docs) {
    const p = doc.data() || {};
    if (p.zohoSyncedAt || (p.zohoTries || 0) >= 10 || !p.uid) continue;
    tried += 1;
    await doc.ref.set({ zohoTries: (p.zohoTries || 0) + 1 }, { merge: true });
    const res = await syncPaymentToZoho(
      db,
      { uid: p.uid, programId: p.programId || 'lep', paymentId: doc.id, orderId: p.orderId, amountPaise: p.amountPaise, testMode: Boolean(p.testMode) },
      deps
    );
    if (res.ok) fixed += 1;
  }
  return { tried, fixed };
}

module.exports = { syncPaymentToZoho, retryFailedPaymentSyncs, paidLeadStatus, paymentNote };
