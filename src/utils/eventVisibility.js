/**
 * Which calendar events a viewer should see.
 * - Global/admin events: no batchId or audience === 'all'
 * - Batch sessions: audience === 'batch' + batchId
 */

export function isGlobalEvent(event) {
  if (!event) return false;
  if (event.audience === 'batch' && event.batchId) return false;
  return !event.batchId || event.audience === 'all' || !event.audience;
}

export function isBatchEvent(event, batchId) {
  return Boolean(batchId && event?.batchId === batchId);
}

/**
 * Student / learner calendar: global events + sessions for their batch.
 */
export function filterEventsForLearner(events, { batchId } = {}) {
  return (events || []).filter((ev) => isGlobalEvent(ev) || isBatchEvent(ev, batchId));
}

/**
 * CX / staff calendar: global events + sessions for batches they moderate.
 */
export function filterEventsForStaff(events, { moderatedBatchIds = [] } = {}) {
  const ids = new Set(moderatedBatchIds.filter(Boolean));
  return (events || []).filter(
    (ev) => isGlobalEvent(ev) || (ev.batchId && ids.has(ev.batchId))
  );
}

/** Strict: only one batch’s sessions (CX batch detail). */
export function filterEventsForBatchOnly(events, batchId) {
  if (!batchId) return [];
  return (events || []).filter((ev) => isBatchEvent(ev, batchId));
}

/** Roles that see batches they moderate rather than a batch they belong to. */
export function isStaffRole(role) {
  return role === 'moderator' || role === 'admin' || role === 'superadmin';
}

/**
 * The one place that decides which events a viewer sees.
 *
 * Home and the Calendar each answered this separately, and drifted: the
 * Calendar was staff-aware while Home always filtered as a learner, so a CX
 * moderator saw their batch's sessions on the Calendar and "No live sessions
 * scheduled" on their dashboard, for the same day and the same batch.
 *
 * @param {object[]} events
 * @param {{ role?: string, batchId?: string, moderatedBatchIds?: string[] }} viewer
 */
export function resolveVisibleEvents(events, { role, batchId, moderatedBatchIds = [] } = {}) {
  if (isStaffRole(role)) {
    return filterEventsForStaff(events, { moderatedBatchIds });
  }
  return filterEventsForLearner(events, { batchId: batchId || '' });
}
