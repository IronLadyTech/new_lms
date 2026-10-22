/**
 * Which kind of learner someone is in a batch — part paid, full paid, late joiner.
 * Pure. Shared by the CMS counts callable and the scheduler (custom messages), so
 * the numbers CX sees and who receives a message always agree.
 *
 * Mirrored in app-new/utils/learnerSegment.js for the app's own filtering.
 */

/** users.programAccess key for a cms_batches program value. */
function accessKey(program) {
  const p = String(program || 'LEP').toLowerCase();
  if (p === '100bm' || p === 'bm100') return '100bm';
  if (p === 'mbw') return 'mbw';
  return 'lep';
}

function payment(data, program) {
  const access = data?.programAccess?.[accessKey(program)] || {};
  const raw = String(access.paymentStatus || data?.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'full' || raw === 'enrolled') return 'paid';
  if (raw === 'register' || raw === 'registered' || raw === 'partial') return 'register';
  return 'unknown';
}

function toMs(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** When the batch began for learners: Orientation start, else Day 1 morning (IST). */
function batchStartMs(batch) {
  const s0 = (batch?.sessions || []).find((s) => s.code === 'S0') || (batch?.sessions || [])[0];
  const fromSession = toMs(s0?.startAt);
  if (fromSession) return fromSession;
  const day = String(batch?.orientationDate || batch?.day1Date || '').slice(0, 10);
  return day ? Date.parse(`${day}T09:00:00+05:30`) : null;
}

/** Her first payment for this program, whichever date field the sync wrote. */
function firstPaymentMs(data, program) {
  const access = data?.programAccess?.[accessKey(program)] || {};
  const times = [
    access.registrationPaidAt,
    access.registeredAt,
    access.fullPaidAt,
    access.enrolledAt,
  ]
    .map(toMs)
    .filter(Boolean);
  return times.length ? Math.min(...times) : null;
}

/** Late joiner: first payment after the batch's Orientation had started. */
function isLateJoiner(data, batch) {
  const start = batchStartMs(batch);
  const paid = firstPaymentMs(data, batch?.program);
  return Boolean(start && paid && paid > start);
}

/** Does a message for `audience` ('all' | 'register' | 'paid' | 'late') reach this learner? */
function inAudience(audience, data, batch) {
  if (!audience || audience === 'all') return true;
  if (audience === 'late') return isLateJoiner(data, batch);
  return payment(data, batch?.program) === audience;
}

function countSegments(learners, batch) {
  const counts = { all: 0, register: 0, paid: 0, late: 0, unknown: 0 };
  for (const data of learners) {
    counts.all += 1;
    counts[payment(data, batch?.program)] += 1;
    if (isLateJoiner(data, batch)) counts.late += 1;
  }
  return counts;
}

module.exports = {
  accessKey,
  payment,
  isLateJoiner,
  inAudience,
  countSegments,
  batchStartMs,
  toMs,
};
