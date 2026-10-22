import { PAYMENT_STATUS } from '../data/accessTiers';

/**
 * Telling apart the two reasons a phase is shut.
 *
 * Payment decides what a learner is eligible for; finishing a phase decides
 * when she reaches it. `resolveGate` collapses both into one boolean, so
 * everything downstream knew a phase was locked but not why — and both task
 * engines assumed payment. A learner who had paid in full, but had not yet
 * finished the phase before, was told to pay again.
 *
 * The only way to separate them is to ask twice: once as the learner is, once
 * as if this one programme were paid for. A phase that opens under the second
 * is one payment alone is holding shut.
 */

/**
 * The same learner, as if this one programme were paid in full.
 *
 * Only the per-programme entry is touched: `programPaymentStatus` prefers it
 * over the flat field, so paying off one programme here cannot leak into
 * another. The paid-on date is dropped rather than invented — a missing date
 * reads as "no expiry known", and the question being asked is what payment
 * would open, not when a window would close.
 *
 * @param {object|null} profile
 * @param {string} programId
 */
export function asFullyPaid(profile, programId) {
  const programAccess = { ...(profile?.programAccess || {}) };
  programAccess[programId] = {
    ...(programAccess[programId] || {}),
    paymentStatus: PAYMENT_STATUS.PAID,
    fullPaidAt: null,
  };
  return { ...(profile || {}), programAccess };
}

/** What is holding a phase shut. */
export const LOCKED_BY = {
  PAYMENT: 'payment',
  SEQUENCE: 'sequence',
};

/**
 * Why each locked phase is locked.
 *
 * @param {(states: object[], profile: object) => Set<string>} getUnlockedPhaseIds
 *   the programme's own phase resolver
 * @param {object[]} taskStates
 * @param {object|null} profile
 * @param {string} programId
 * @returns {(phase: string) => string|null} null when the phase is open
 */
export function buildPhaseLockReason(getUnlockedPhaseIds, taskStates, profile, programId) {
  const open = getUnlockedPhaseIds(taskStates, profile);
  const openIfPaid = getUnlockedPhaseIds(taskStates, asFullyPaid(profile, programId));

  return (phase) => {
    if (open.has(phase)) return null;
    /* It opens once paid, so money is what is in the way. Otherwise the phase
       before it is unfinished, and paying would change nothing. */
    return openIfPaid.has(phase) ? LOCKED_BY.PAYMENT : LOCKED_BY.SEQUENCE;
  };
}
