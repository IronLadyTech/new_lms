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
  if (['paid', 'full', 'complete', 'full_payment'].includes(v)) return PAYMENT_STATUS.PAID;
  if (['register', 'registration', 'reg', 'partial', 'registration_fee'].includes(v)) {
    return PAYMENT_STATUS.REGISTER;
  }
  if (['unpaid', 'not paid', 'pending', 'none', ''].includes(v)) return PAYMENT_STATUS.UNPAID;
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
  if (['mbw', 'master of business warfare', 'business warfare'].includes(v) || v.includes('business warfare')) {
    return 'mbw';
  }
  if (['lep', 'leadership essentials program', 'leadership essentials'].includes(v) || v.includes('leadership essentials')) {
    return 'lep';
  }
  if (['100bm', '100 board members program', '100 board members', '100 business minds'].includes(v) || v.includes('100 board')) {
    return '100bm';
  }
  return v || null;
}

/** Pre-IL → IL registration Deluge: paymentstatus "Completed" = registration fee paid. */
function paymentStatusFromRegistrationPayload(body = {}) {
  const reg = (body.paymentstatus || body.paymentStatus || '').toString().toLowerCase().trim();
  if (reg === 'completed') return PAYMENT_STATUS.REGISTER;

  const prog = (
    body.programPaymentStatus ||
    body.MBWPaymentStatus ||
    body.lepPaymentStatus ||
    body.hundredBMPaymentStatus ||
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

module.exports = {
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
