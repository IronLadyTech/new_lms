/**
 * Who gets which LEP reminder, and how its text is finished. Pure — no Firestore.
 *
 * Mirrored for the CMS "Messages" screen in app-new/utils/batchMessagePlan.js,
 * so what CX sees there is what this scheduler sends. Change both together.
 */

/** Live sessions a part-paid (registered) learner can attend. */
const REGISTERED_SESSION_CODES = new Set(['S0', 'S1', 'S2']);

/**
 * Conditions the scheduler can check today. "Only if attended / absent / task not
 * done" need attendance and task data per learner; until then those messages are
 * held back rather than sent to everyone — "We missed you" must never reach
 * someone who was there.
 */
const SENDABLE_CONDITIONS = new Set(['', 'all']);

function sendableNow(event) {
  const condition = String(event?.condition || '').trim();
  return SENDABLE_CONDITIONS.has(condition);
}

function reachesLearner(session, paymentStatus) {
  if (paymentStatus === 'register') return REGISTERED_SESSION_CODES.has(session?.code);
  return true;
}

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/** Fill placeholders, then tidy what an empty value leaves behind. */
function finishText(text, vars) {
  let source = String(text || '');
  // No Zoom link on the session yet: point to the app instead of a blank "Join:".
  if (!vars.joinLink)
    source = source.replace(/Join:?\s*\{\{joinLink\}\}/gi, 'Join from the Iron Lady app.');
  const filled = fillTemplate(source, { ...vars, joinLink: vars.joinLink || 'the Iron Lady app' });
  return (
    filled
      .replace(/\s+([.,!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/[.]{2,}/g, '.')
      .trim()
      // An empty last placeholder leaves "Next:" — end the sentence instead.
      .replace(/[:\s]+$/, '.')
  );
}

/** IST wall-clock hour of an ISO time. */
function istHour(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }).format(d)
  );
}

/**
 * "Session tomorrow" for a morning session (before 12 PM) goes out at 7:00 PM IST
 * the evening before, not 24 hours ahead at dawn.
 */
function adjustFireAt(event, session, fireAtMs) {
  if (event?.code !== 'R-24h' || !session?.startAt) return fireAtMs;
  const hour = istHour(session.startAt);
  if (hour == null || hour >= 12) return fireAtMs;
  const day = String(session.date || '').slice(0, 10);
  if (!day) return fireAtMs;
  const prev = new Date(`${day}T19:00:00+05:30`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.getTime();
}

module.exports = {
  REGISTERED_SESSION_CODES,
  sendableNow,
  reachesLearner,
  finishText,
  adjustFireAt,
};
