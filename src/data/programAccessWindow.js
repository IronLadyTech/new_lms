/**
 * How long a learner keeps a programme after paying for it in full.
 *
 * The clock starts the day the full course amount is confirmed — the moment the
 * lead reaches "<programme> started" and the content unlocks — not the day they
 * registered and not the cohort start date. A learner who pays late gets the
 * same window as one who paid early.
 *
 * Window = the programme's own length, plus a year.
 */
import { PROGRAMS } from './programTypes';

/** Programme length in months, before the extra year. */
export const PROGRAM_LENGTH_MONTHS = {
  [PROGRAMS.LEP]: 1,
  [PROGRAMS.BM100]: 6,
  [PROGRAMS.MBW]: 12,
};

/** Every programme keeps access for a further year after it ends. */
export const GRACE_MONTHS = 12;

/** Total months of access from the day full payment completes. */
export function accessMonthsFor(programId) {
  const length = PROGRAM_LENGTH_MONTHS[programId];
  return length == null ? null : length + GRACE_MONTHS;
}

function toDate(value) {
  if (!value) return null;
  // Firestore Timestamps arrive with toDate(); ISO strings and Dates do not.
  const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Add whole months without rolling into the next one.
 *
 * new Date(2026, 0, 31) + 1 month lands on 2 March, because February has no
 * 31st. A learner who paid on the 31st would lose two days. Clamped to the last
 * day of the target month instead.
 */
function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * When access ends. Null when we cannot say — an unknown programme, or no
 * payment date on file. Null means "no expiry known", never "expired": a
 * missing date must not lock out a paying learner.
 */
export function accessExpiresAt(programId, paidAt) {
  const months = accessMonthsFor(programId);
  const start = toDate(paidAt);
  if (months == null || !start) return null;
  return addMonths(start, months);
}

/** True only when we know the date and it has passed. */
export function isAccessExpired(programId, paidAt, now = new Date()) {
  const end = accessExpiresAt(programId, paidAt);
  if (!end) return false;
  return now.getTime() >= end.getTime();
}

/** Whole days left, or null when there is no known end date. */
export function daysUntilExpiry(programId, paidAt, now = new Date()) {
  const end = accessExpiresAt(programId, paidAt);
  if (!end) return null;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

/**
 * The day the full course amount cleared for this programme, as written by
 * provisioning. Null for a learner who has not paid in full, and for everyone
 * who paid before this was recorded — which is why a missing date must mean
 * "no expiry known" rather than "expired".
 */
export function fullPaidAtFor(profile, programId) {
  return profile?.programAccess?.[programId]?.fullPaidAt ?? null;
}

/** True only when this learner's window for this programme has closed. */
export function isProgramAccessExpired(profile, programId, now = new Date()) {
  return isAccessExpired(programId, fullPaidAtFor(profile, programId), now);
}

/** When this learner's access to this programme ends, or null if unknown. */
export function programAccessEndsAt(profile, programId) {
  return accessExpiresAt(programId, fullPaidAtFor(profile, programId));
}
