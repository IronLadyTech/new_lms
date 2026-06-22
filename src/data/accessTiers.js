/** Zoho payment terminology — used across blueprint stages (no Zoho changes needed). */

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  REGISTER: 'register',
  PAID: 'paid',
};

export const ACCESS_TIERS = {
  REGISTRATION: 'registration',
  FULL: 'full',
};

/** Normalizes Zoho payment status values to: unpaid | register | paid */
export function normalizePaymentStatus(value) {
  const v = (value || '').toString().toLowerCase().trim();
  if (['paid', 'full', 'complete', 'full_payment'].includes(v)) return PAYMENT_STATUS.PAID;
  if (['register', 'registration', 'reg', 'partial', 'registration_fee'].includes(v)) {
    return PAYMENT_STATUS.REGISTER;
  }
  if (['unpaid', 'not paid', 'pending', 'none', ''].includes(v)) return PAYMENT_STATUS.UNPAID;
  return v || PAYMENT_STATUS.UNPAID;
}

export function normalizeAccessTier(value) {
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

/** Maps Zoho payment terminology → LMS access tier. */
export function accessTierFromPaymentStatus(paymentStatus) {
  const ps = normalizePaymentStatus(paymentStatus);
  if (ps === PAYMENT_STATUS.PAID) return ACCESS_TIERS.FULL;
  if (ps === PAYMENT_STATUS.REGISTER) return ACCESS_TIERS.REGISTRATION;
  return null;
}

export function resolveAccessTier(profile) {
  const fromPayment = accessTierFromPaymentStatus(profile?.paymentStatus);
  if (fromPayment) return fromPayment;
  return normalizeAccessTier(profile?.accessTier);
}

export function hasFullProgramAccess(profile) {
  const ps = normalizePaymentStatus(profile?.paymentStatus);
  if (ps === PAYMENT_STATUS.PAID) return true;
  if (ps === PAYMENT_STATUS.REGISTER || ps === PAYMENT_STATUS.UNPAID) return false;

  const tier = resolveAccessTier(profile);
  if (!tier) return true;
  return tier === ACCESS_TIERS.FULL;
}

export function hasAnyProgramAccess(profile) {
  const ps = normalizePaymentStatus(profile?.paymentStatus);
  if (ps === PAYMENT_STATUS.UNPAID) return false;
  if (ps === PAYMENT_STATUS.REGISTER || ps === PAYMENT_STATUS.PAID) return true;

  const tier = resolveAccessTier(profile);
  if (!tier) return true;
  return tier === ACCESS_TIERS.REGISTRATION || tier === ACCESS_TIERS.FULL;
}

export function getPaymentStatusLabel(status) {
  const ps = normalizePaymentStatus(status);
  if (ps === PAYMENT_STATUS.PAID) return 'Paid — full program';
  if (ps === PAYMENT_STATUS.REGISTER) return 'Register — partial access';
  if (ps === PAYMENT_STATUS.UNPAID) return 'Unpaid — no LMS access yet';
  return status || 'Unknown';
}

export function getAccessTierLabel(profile) {
  const ps = normalizePaymentStatus(profile?.paymentStatus);
  if (ps === PAYMENT_STATUS.PAID) return 'Full program access';
  if (ps === PAYMENT_STATUS.REGISTER) return 'Registration access (intro + initial tasks)';
  if (ps === PAYMENT_STATUS.UNPAID) return 'Awaiting registration payment';

  const tier = resolveAccessTier(profile);
  if (tier === ACCESS_TIERS.FULL) return 'Full program access';
  if (tier === ACCESS_TIERS.REGISTRATION) return 'Registration access';
  return 'No program access';
}
