/**
 * Phone numbers and messaging consent.
 *
 * WhatsApp will only accept a number in E.164 — a plus, a country code, then
 * the digits, with nothing else. Numbers reaching us from Zoho and from sign-up
 * forms are written however the person happened to type them: with spaces, with
 * a leading zero, as ten digits with no country code, occasionally with a
 * "+91-" prefix and dashes throughout.
 *
 * Sending an unnormalised number does not throw — it silently fails to deliver,
 * which is the worst kind of failure because the reminder looks sent. So the
 * conversion happens once, here, and anything that cannot be made valid is
 * reported as unusable rather than passed on hopefully.
 */

/** India, because that is where the learners are. Others can be added. */
const DEFAULT_COUNTRY_CODE = '91';

/**
 * Indian mobile numbers are ten digits and never start with 0–5.
 *
 * This cannot separate a mobile from a landline written without its area code:
 * a Bangalore number, 080 then eight digits, looks exactly like a mobile once
 * the leading zero is removed. Nothing in the number distinguishes them, so such
 * a number passes here and never delivers — which the delivery receipts report,
 * and stricter parsing could not.
 */
const INDIA_MOBILE = /^[6-9]\d{9}$/;

/**
 * Reduce a written phone number to E.164, or explain why it cannot be.
 *
 * Returns `{ e164, ok, reason }` rather than a bare string, so a caller can tell
 * "no number" from "a number we could not use" — they need different chasing.
 */
export function toE164(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  const input = String(raw ?? '').trim();
  if (!input) return { e164: null, ok: false, reason: 'missing' };

  // Keep a leading plus; drop spaces, dashes, brackets and anything else.
  const hadPlus = input.startsWith('+');
  const digits = input.replace(/\D/g, '');
  if (!digits) return { e164: null, ok: false, reason: 'no digits' };

  let national = digits;

  if (hadPlus || digits.length > 10) {
    // Already carries a country code, or is long enough that it must.
    if (national.startsWith(countryCode)) {
      national = national.slice(countryCode.length);
    } else if (national.startsWith('0' + countryCode)) {
      national = national.slice(countryCode.length + 1);
    }
  }

  // A single leading zero is how people write numbers domestically.
  national = national.replace(/^0+/, '');

  if (!INDIA_MOBILE.test(national)) {
    return {
      e164: null,
      ok: false,
      reason: national.length < 10 ? 'too short' : 'not a mobile number',
    };
  }

  return { e164: `+${countryCode}${national}`, ok: true, reason: null };
}

/** Consent as stored on the learner's record. */
export const CONSENT_SOURCES = {
  ENROLMENT: 'enrolment',
  PROFILE: 'profile',
  CX: 'cx',
};

/**
 * Whether we may message this learner.
 *
 * Deliberately strict: consent must be explicitly true. A record with no consent
 * field is treated as "not given", never as "probably fine" — the whole point of
 * asking is to be able to show that they said yes.
 */
export function hasMessagingConsent(user) {
  return user?.messagingConsent?.granted === true;
}

/**
 * Can this learner actually be sent a reminder, and if not, why not.
 *
 * The reasons matter as much as the answer: a missing number is a job for
 * whoever holds the contact records, an unusable number is a data-cleaning job,
 * and missing consent is a question somebody has to ask the learner.
 */
export function reachability(user) {
  if (!hasMessagingConsent(user)) {
    return { reachable: false, reason: 'no consent', e164: null };
  }
  const { e164, ok, reason } = toE164(user?.phone);
  if (!ok) return { reachable: false, reason: `phone ${reason}`, e164: null };
  return { reachable: true, reason: null, e164 };
}

/** Counts for a cohort, so the gap is a number rather than an impression. */
export function summariseReachability(users = []) {
  const summary = { total: users.length, reachable: 0, byReason: {} };
  users.forEach((u) => {
    const { reachable, reason } = reachability(u);
    if (reachable) summary.reachable += 1;
    else summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
  });
  return summary;
}
