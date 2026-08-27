/**
 * A daily ceiling on Zoho API calls, so the LMS can never spend the org's
 * whole quota again.
 *
 * The rule that matters: running out of quota must not stop a learner getting
 * in. So the budget is split — background work (the reconcile poll, activity
 * notes, bulk syncs) is cut off at a soft ceiling, while work a person is
 * waiting on (login provisioning, password reset, an inbound webhook) keeps
 * spending up to the hard ceiling. Background work stopping is invisible and
 * self-correcting on the next pass; a learner locked out is neither.
 *
 * Counted in memory per instance and reconciled to Firestore, so several
 * instances share one budget rather than each getting its own.
 */

const COLLECTION = 'zoho_budget';

/** Zoho's per-day credit allowance for the plan. Override with ZOHO_DAILY_BUDGET. */
const DEFAULT_DAILY_BUDGET = Number(process.env.ZOHO_DAILY_BUDGET || 5000);

/** Background work stops here, leaving the rest for people waiting on a response. */
const BACKGROUND_SHARE = 0.7;

const PRIORITY = {
  /** A person is waiting: login, password reset, inbound webhook. */
  ESSENTIAL: 'essential',
  /** Polls, notes, bulk passes. Skipping is invisible and retried later. */
  BACKGROUND: 'background',
};

let cached = { day: null, spent: 0, syncedAt: 0 };

function today() {
  // Asia/Kolkata, matching the schedules, so the day rolls when the team's does.
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const day = today();
  if (cached.day !== day) cached = { day, spent: 0, syncedAt: 0 };
  return cached;
}

/** Pull the shared count, so instances do not each spend a full budget. */
async function refresh(db) {
  const state = resetIfNewDay();
  // At most once every 30s: the point is a shared ceiling, not an exact meter.
  if (Date.now() - state.syncedAt < 30000) return state;
  try {
    const snap = await db.collection(COLLECTION).doc(state.day).get();
    const remote = snap.exists ? snap.data()?.spent || 0 : 0;
    state.spent = Math.max(state.spent, remote);
    state.syncedAt = Date.now();
  } catch {
    // A budget we cannot read must not block essential work; the in-memory
    // count still applies.
  }
  return state;
}

function ceilingFor(priority) {
  return priority === PRIORITY.ESSENTIAL
    ? DEFAULT_DAILY_BUDGET
    : Math.floor(DEFAULT_DAILY_BUDGET * BACKGROUND_SHARE);
}

/**
 * May this work run? Ask before a batch, not before every call.
 * @returns {Promise<{ok: boolean, spent: number, ceiling: number}>}
 */
async function canSpend(db, priority = PRIORITY.BACKGROUND, cost = 1) {
  const state = await refresh(db);
  const ceiling = ceilingFor(priority);
  return { ok: state.spent + cost <= ceiling, spent: state.spent, ceiling };
}

/** Record calls actually made. Cheap in memory; flushed to Firestore. */
async function record(db, count = 1) {
  const state = resetIfNewDay();
  state.spent += count;
  try {
    const { FieldValue } = require('firebase-admin/firestore');
    await db
      .collection(COLLECTION)
      .doc(state.day)
      .set(
        { spent: FieldValue.increment(count), day: state.day, updatedAt: new Date() },
        { merge: true }
      );
  } catch {
    // The in-memory count still protects this instance.
  }
  return state.spent;
}

/** For the digest and the admin panel. */
async function status(db) {
  const state = await refresh(db);
  return {
    day: state.day,
    spent: state.spent,
    dailyBudget: DEFAULT_DAILY_BUDGET,
    backgroundCeiling: ceilingFor(PRIORITY.BACKGROUND),
    backgroundStopped: state.spent >= ceilingFor(PRIORITY.BACKGROUND),
  };
}

/** Test seam. */
function __reset() {
  cached = { day: null, spent: 0, syncedAt: 0 };
}

module.exports = {
  PRIORITY,
  canSpend,
  record,
  status,
  DEFAULT_DAILY_BUDGET,
  BACKGROUND_SHARE,
  __reset,
};
