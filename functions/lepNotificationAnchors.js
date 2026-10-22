/**
 * Resolve CMS notification anchor fire times from cms_batches.sessions.
 * Copy alongside lepNotificationScheduler.js in new_lms functions.
 */

const { adjustFireAt } = require('./lepReminderRules');

const CORE_SESSION_CODES = new Set(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);

function parseMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function sessionsForRef(batch, ref) {
  const sessions = batch?.sessions || [];
  if (!ref || ref === '*') {
    return sessions.filter((s) => CORE_SESSION_CODES.has(s.code));
  }
  if (ref === 'FT') return sessions.filter((s) => s.code === 'FT');
  if (ref === 'PTW') {
    return sessions.filter(
      (s) => s.code === 'PTW' || s.notifyRef === 'PTW' || String(s.code).startsWith('PTW')
    );
  }
  return sessions.filter((s) => s.code === ref || s.notifyRef === ref);
}

function formatIstTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/**
 * @returns {Array<{ event, session, fireAtMs, dedupeKey, vars }>}
 */
function sessionAnchorFires(batch, event, windowStartMs, windowEndMs) {
  const anchor = event.anchor || {};
  if (anchor.type !== 'sessionStart' && anchor.type !== 'sessionEnd') return [];

  const offset = (anchor.offsetMinutes || 0) * 60 * 1000;
  const targets = sessionsForRef(batch, anchor.ref);
  const out = [];

  for (const session of targets) {
    const edge = anchor.type === 'sessionStart' ? parseMs(session.startAt) : parseMs(session.endAt);
    if (!edge) continue;
    const fireAtMs = adjustFireAt(event, session, edge + offset);
    if (fireAtMs < windowStartMs || fireAtMs > windowEndMs) continue;

    const dedupeKey = `${batch.id}|${event.code}|${session.code}|${anchor.type}|${fireAtMs}`;
    out.push({
      event,
      session,
      fireAtMs,
      dedupeKey,
      vars: {
        name: 'there',
        session: session.title || session.code,
        time: formatIstTime(session.startAt),
        task: '',
        joinLink: session.joinLink || '',
        date: session.date || '',
      },
    });
  }
  return out;
}

module.exports = {
  sessionAnchorFires,
  sessionsForRef,
};
