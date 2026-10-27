/**
 * CMS notification anchors that are a clock time, not a session edge:
 *   day1   — one day relative to the batch's Day 1, at a time (C04 "1 day before Day 1 at 10:00")
 *   daily  — every day in a window, at a time (RITUALS-AM 07:00)
 *   weekly — one weekday in that window, at a time (SCORE, Sat 12:00)
 *
 * Times are IST wall clock ("HH:MM"). The window is anchor.fromDay … anchor.toDay
 * (days from Day 1) when CX set them; otherwise Day 1 to the batch's last core session.
 * Pure — no Firestore. Mirrored for the CMS Messages screen in app-new/utils/batchMessagePlan.js.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CORE_SESSION_CODES = new Set(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);

/** The 5 Rituals unlock on Week 1 Monday (Day 2), after the two full days. */
const RITUALS_FIRST_DAY = 2;
const RITUALS_CODES = new Set(['RITUALS-AM', 'RITUALS-PM']);

function isoDay(value) {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Days between two YYYY-MM-DD dates (b − a). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** ms for an IST wall-clock time on a day, or null when the time is not "HH:MM". */
function istMs(day, hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Date.parse(`${day}T${m[1].padStart(2, '0')}:${m[2]}:00+05:30`);
}

function lastCoreSessionDay(batch, day1) {
  const days = (batch?.sessions || [])
    .filter((s) => CORE_SESSION_CODES.has(s.code) && !s.cancelled)
    .map((s) => isoDay(s.date))
    .filter(Boolean)
    .sort();
  const last = days[days.length - 1];
  return last && last >= day1 ? daysBetween(day1, last) : 28;
}

/** [fromDay, toDay] relative to Day 1 for a daily / weekly rule. */
function windowFor(batch, event, day1) {
  const anchor = event.anchor || {};
  const from = Number.isFinite(anchor.fromDay)
    ? anchor.fromDay
    : RITUALS_CODES.has(event.code)
      ? RITUALS_FIRST_DAY
      : 0;
  const to = Number.isFinite(anchor.toDay) ? anchor.toDay : lastCoreSessionDay(batch, day1);
  return [from, to];
}

/** Every day (YYYY-MM-DD) this rule fires on for the batch, with its offset from Day 1. */
function fireDays(batch, event) {
  const anchor = event.anchor || {};
  const day1 = isoDay(batch?.day1Date);
  if (!day1) return [];
  if (anchor.type === 'day1') {
    const n = Number(anchor.dayOffset) || 0;
    return [{ day: addDays(day1, n), offset: n }];
  }
  if (anchor.type !== 'daily' && anchor.type !== 'weekly') return [];
  const [from, to] = windowFor(batch, event, day1);
  const out = [];
  const weekday = WEEKDAYS.indexOf(anchor.weekday || 'Sat');
  for (let n = from; n <= to; n += 1) {
    const day = addDays(day1, n);
    if (anchor.type === 'weekly' && new Date(`${day}T00:00:00Z`).getUTCDay() !== weekday) continue;
    out.push({ day, offset: n });
  }
  return out;
}

/**
 * @returns {Array<{ event, day, offset, fireAtMs, dedupeKey, vars }>} fires inside the window.
 */
function timeAnchorFires(batch, event, windowStartMs, windowEndMs) {
  const anchor = event.anchor || {};
  const out = [];
  for (const { day, offset } of fireDays(batch, event)) {
    const fireAtMs = istMs(day, anchor.time);
    if (fireAtMs == null || fireAtMs < windowStartMs || fireAtMs > windowEndMs) continue;
    out.push({
      event,
      day,
      offset,
      fireAtMs,
      dedupeKey: `${batch.id}|${event.code}|${anchor.type}|${day}`,
      vars: { name: 'there', batch: batch.name || '', date: day },
    });
  }
  return out;
}

module.exports = { timeAnchorFires, fireDays, windowFor, istMs, RITUALS_FIRST_DAY };
