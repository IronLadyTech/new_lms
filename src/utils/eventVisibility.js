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
