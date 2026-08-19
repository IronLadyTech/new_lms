/** Server-side — mirrors src/data/accessTiers.js (Zoho: unpaid | register | paid). */

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  REGISTER: 'register',
  PAID: 'paid',
};

const ACCESS_TIERS = {
  REGISTRATION: 'registration',
  FULL: 'full',
};

function normalizePaymentStatus(value) {
  const v = (value || '').toString().toLowerCase().trim();
  // 'completed' is what Zoho writes on a full payment — 'complete' alone missed
  // it. Registration-only learners are marked 'register', a separate value, so
  // this cannot swallow a part payment. Unranked values also stored raw here,
  // which is how 'completed' reached 157 profiles instead of 'paid'.
  if (['paid', 'full', 'complete', 'full_payment', 'paid_full'].includes(v)) {
    return PAYMENT_STATUS.PAID;
  }
  /*
   * 'completed' is the *registration* transaction completing, not the programme
   * fee. The Deluge that converts Pre-IL Registration posts
   * paymentstatus:"Completed" for the registration payment, and the enrolment
   * Deluge deliberately omits it — its own comment reads "Do NOT send
   * paymentstatus Completed here, LMS treats that as registration (partial)
   * only". paymentStatusFromRegistrationPayload already maps it that way; this
   * agrees with it rather than contradicting it.
   */
  if (['register', 'registration', 'reg', 'partial', 'registration_fee', 'completed'].includes(v)) {
    return PAYMENT_STATUS.REGISTER;
  }
  // A payment that did not succeed is not a payment.
  if (
    [
      'unpaid',
      'not paid',
      'pending',
      'none',
      '',
      'failed',
      'declined',
      'rejected',
      'cancelled',
      'canceled',
      'refunded',
      'expired',
      'chargeback',
    ].includes(v)
  ) {
    return PAYMENT_STATUS.UNPAID;
  }
  return v || PAYMENT_STATUS.UNPAID;
}

function normalizeAccessTier(value) {
  const v = (value || '').toString().toLowerCase().trim();
  if (['full', 'complete', 'paid_full', 'full_payment', 'paid'].includes(v)) {
    return ACCESS_TIERS.FULL;
  }
  if (['registration', 'register', 'partial', 'limited', 'registration_fee', 'reg'].includes(v)) {
    return ACCESS_TIERS.REGISTRATION;
  }
  if (['unpaid', 'not paid', 'pending'].includes(v)) return null;
  return v || null;
}

function accessTierFromPaymentStatus(paymentStatus) {
  const ps = normalizePaymentStatus(paymentStatus);
  if (ps === PAYMENT_STATUS.PAID) return ACCESS_TIERS.FULL;
  if (ps === PAYMENT_STATUS.REGISTER) return ACCESS_TIERS.REGISTRATION;
  return null;
}

const PAYMENT_RANK = {
  [PAYMENT_STATUS.UNPAID]: 0,
  [PAYMENT_STATUS.REGISTER]: 1,
  [PAYMENT_STATUS.PAID]: 2,
};

/** Never downgrade: unpaid < register < paid (webhook re-runs safe). */
function maxPaymentStatus(current, incoming) {
  const c = normalizePaymentStatus(current);
  const i = normalizePaymentStatus(incoming);
  const cRank = PAYMENT_RANK[c] ?? 0;
  const iRank = PAYMENT_RANK[i] ?? 0;
  return iRank >= cRank ? i : c;
}

function resolveAccessTier(profile) {
  const fromPayment = accessTierFromPaymentStatus(profile?.paymentStatus);
  if (fromPayment) return fromPayment;
  return normalizeAccessTier(profile?.accessTier);
}

function normalizeProgram(value) {
  const v = (value || '').toString().toLowerCase().trim();
  if (
    ['mbw', 'master of business warfare', 'business warfare'].includes(v) ||
    v.includes('business warfare')
  ) {
    return 'mbw';
  }
  if (
    ['lep', 'leadership essentials program', 'leadership essentials'].includes(v) ||
    v.includes('leadership essentials')
  ) {
    return 'lep';
  }
  if (
    [
      '100bm',
      '100 bm',
      '100bm program',
      '100 board members program',
      '100 board members',
      '100 business minds',
    ].includes(v) ||
    /100\s*bm/.test(v) ||
    v.includes('100 board')
  ) {
    return '100bm';
  }
  return v || null;
}

/** Pre-IL → IL registration Deluge: paymentstatus "Completed" = registration fee paid. */
function paymentStatusFromRegistrationPayload(body = {}) {
  // Default params do not apply when callers pass `null` (batch apply / email provision).
  const payload = body && typeof body === 'object' ? body : {};
  const reg = (payload.paymentstatus || payload.paymentStatus || '')
    .toString()
    .toLowerCase()
    .trim();
  if (reg === 'completed') return PAYMENT_STATUS.REGISTER;

  const prog = (
    payload.programPaymentStatus ||
    payload.MBWPaymentStatus ||
    payload.lepPaymentStatus ||
    payload.hundredBMPaymentStatus ||
    ''
  )
    .toString()
    .toLowerCase()
    .trim();
  if (prog === 'completed') return PAYMENT_STATUS.PAID;

  return null;
}

const PROGRAM_COURSE_CODE = {
  mbw: 'MBW',
  lep: 'LEP',
  '100bm': '100BM',
};


/* ── Entitlement, server side ───────────────────────────────────────────────
 * Mirrors src/data/accessTiers.js and src/data/programAccessWindow.js.
 *
 * The client copy decides what to draw; this one decides what to hand over.
 * They must agree, but only this one is a control — anything the browser is
 * given, the person holding the browser can read.
 * ────────────────────────────────────────────────────────────────────────── */

/** Programme length in months, before the extra year of access. */
const PROGRAM_LENGTH_MONTHS = { lep: 1, '100bm': 6, mbw: 12 };
const GRACE_MONTHS = 12;

/** What this learner has paid for this programme specifically. */
function programPaymentStatus(profile, programId) {
  const perProgram = profile?.programAccess?.[programId]?.paymentStatus;
  if (perProgram) return normalizePaymentStatus(perProgram);
  return normalizePaymentStatus(profile?.paymentStatus);
}

function toDate(value) {
  if (!value) return null;
  const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** True only when a window is known and has closed. Unknown never expires. */
function isProgramAccessExpired(profile, programId, now = new Date()) {
  const length = PROGRAM_LENGTH_MONTHS[programId];
  const start = toDate(profile?.programAccess?.[programId]?.fullPaidAt);
  if (length == null || !start) return false;
  return now.getTime() >= addMonths(start, length + GRACE_MONTHS).getTime();
}

/**
 * Every programme this profile is enrolled in, normalised and deduplicated.
 *
 * Restricted to the programmes we actually run. normalizeProgram lowercases
 * whatever it is handed rather than rejecting an unknown name, so without this
 * filter a stray value like "Executive Bootcamp" becomes a programme id that no
 * programAccess entry can ever satisfy — and the backfill would reselect that
 * profile on every run, forever.
 */
function enrolledProgramIds(profile) {
  const known = new Set(Object.keys(PROGRAM_LENGTH_MONTHS));
  const list = Array.isArray(profile?.programs) ? profile.programs : [];
  const all = [profile?.program, ...list].map(normalizeProgram).filter((id) => known.has(id));
  return Array.from(new Set(all));
}

/**
 * Is this profile still on the pre-per-programme shape?
 *
 * Before payment was tracked per programme there was one flat paymentStatus,
 * and "paid" meant "paid for something". programPaymentStatus still falls back
 * to it when a programme has no entry of its own, so such a profile gets its
 * highest tier applied to every programme it is enrolled in — somebody who paid
 * a registration fee for one course reads as fully paid for all of them.
 *
 * Only profiles that stand to gain from the fallback are counted. A flat unpaid
 * grants nothing, so there is nothing to correct and no reason to spend a Zoho
 * lookup on it.
 */
function needsEntitlementBackfill(profile) {
  if (!profile?.email) return false;
  if (normalizePaymentStatus(profile.paymentStatus) === PAYMENT_STATUS.UNPAID) return false;

  const programs = enrolledProgramIds(profile);
  if (!programs.length) return false;

  return programs.some((id) => !profile?.programAccess?.[id]?.paymentStatus);
}

/** Is this programme enrolled at all? Mirrors getEnrolledProgramIds. */
function isEnrolledInProgram(profile, programId) {
  if (!profile || !programId) return false;
  const list = (v) => (Array.isArray(v) ? v : []);
  if (normalizeProgram(profile.program) === programId) return true;
  return list(profile.programs).some((v) => normalizeProgram(v) === programId);
}

/**
 * The single question the asset gate asks: may this learner have the paid
 * content of this programme, right now?
 *
 * Returns a reason rather than a bare boolean so the caller can answer the
 * learner honestly instead of a blanket denial.
 */
function paidContentDecision(profile, programId, now = new Date()) {
  if (!profile) return { allowed: false, reason: 'no-profile' };
  if (!isEnrolledInProgram(profile, programId)) {
    return { allowed: false, reason: 'not-enrolled' };
  }
  if (programPaymentStatus(profile, programId) !== PAYMENT_STATUS.PAID) {
    return { allowed: false, reason: 'payment-required' };
  }
  if (isProgramAccessExpired(profile, programId, now)) {
    return { allowed: false, reason: 'access-expired' };
  }
  return { allowed: true, reason: null };
}

module.exports = {
  enrolledProgramIds,
  needsEntitlementBackfill,
  PROGRAM_LENGTH_MONTHS,
  GRACE_MONTHS,
  programPaymentStatus,
  isProgramAccessExpired,
  isEnrolledInProgram,
  paidContentDecision,
  PAYMENT_STATUS,
  ACCESS_TIERS,
  normalizePaymentStatus,
  normalizeAccessTier,
  accessTierFromPaymentStatus,
  maxPaymentStatus,
  resolveAccessTier,
  normalizeProgram,
  PROGRAM_COURSE_CODE,
  paymentStatusFromRegistrationPayload,
};
