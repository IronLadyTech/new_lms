/**
 * Batch reminders switch themselves on.
 *
 * CX used to press "Start reminders" on every batch. Now the scheduler does it on its next
 * run (every 15 min) once a batch is ready — the same required checks the CMS checklist
 * shows (app-new utils/batchReminderChecks.js):
 *   - dates set (day1Date, or startDate)
 *   - a session schedule
 *   - linked to its learners (lmsGroupId)
 * and only while the batch still has a session today or later, so a finished batch is never
 * woken up.
 *
 * Never started = status 'draft' (or none). A batch CX paused stays status 'live' with
 * automationEnabled false, so it is never restarted here; CX starts it again by hand.
 */

function isoDay(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Today's date in India (YYYY-MM-DD). */
function istToday(nowMs) {
  return new Date(nowMs + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** null when the batch should start now; otherwise why not (for logs and tests). */
function whyNotAutoStart(batch, todayIso) {
  if (!batch) return 'no-batch';
  if (batch.status && batch.status !== 'draft') return 'already-started-or-paused';
  if (batch.automationEnabled === true) return 'already-on';
  if (batch.remindersPaused === true) return 'paused-by-cx';
  if (!isoDay(batch.day1Date) && !isoDay(batch.startDate)) return 'no-dates';
  const sessions = (batch.sessions || []).filter((s) => s && !s.cancelled);
  if (!sessions.length) return 'no-sessions';
  const groups = [batch.lmsGroupId, ...(Array.isArray(batch.lmsGroupIds) ? batch.lmsGroupIds : [])];
  if (!groups.some((g) => String(g || '').trim())) return 'not-linked';
  const last = sessions
    .map((s) => isoDay(s.date) || isoDay(s.startAt))
    .filter(Boolean)
    .sort()
    .pop();
  if (!last || last < todayIso) return 'finished';
  return null;
}

/** Switch on every ready batch. Returns the ids it started. */
async function autoStartReadyBatches(db, nowMs = Date.now()) {
  const today = istToday(nowMs);
  const snap = await db.collection('cms_batches').get();
  const started = [];
  for (const d of snap.docs) {
    const batch = { id: d.id, ...d.data() };
    if (whyNotAutoStart(batch, today)) continue;
    await d.ref.set(
      { status: 'live', automationEnabled: true, autoStartedAt: new Date(nowMs), updatedAt: new Date(nowMs) },
      { merge: true }
    );
    started.push(d.id);
  }
  if (started.length) console.log('[lepNotificationScheduler] reminders started by themselves:', started.join(', '));
  return started;
}

module.exports = { autoStartReadyBatches, whyNotAutoStart, istToday };
