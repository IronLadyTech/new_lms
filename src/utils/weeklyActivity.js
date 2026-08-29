/**
 * How much a learner finished this week, counted from their own submissions.
 *
 * This replaces an "Hours spent" panel that the prototype showed but that
 * nothing in the product could ever fill: lessons record a watch percentage,
 * never a duration, so any hours figure would have been invented. Completions
 * answer the same question a learner is actually asking — am I moving? — and
 * every number here comes from a submission that exists.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A submission counts as done when the learner has actually sent it. */
const DONE_STATUSES = new Set(['submitted', 'under_review', 'completed']);

/**
 * Submissions are keyed by task id and arrive from up to three task engines,
 * one per programme. Ids are unique across programmes, so merging is safe.
 */
export function mergeSubmissions(...maps) {
  return maps.filter(Boolean).reduce((all, m) => Object.assign(all, m), {});
}

function submittedTime(sub) {
  const raw = sub?.submittedAt;
  if (!raw) return null;
  // Firestore hands back a Timestamp on read and an ISO string on local write.
  const ms = typeof raw?.toMillis === 'function' ? raw.toMillis() : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Completions in the last seven days, and in the seven before that.
 *
 * A rolling window rather than calendar weeks: on a Monday morning a
 * calendar-week count reads zero and tells a learner they have done nothing,
 * which is both discouraging and untrue.
 *
 * @param {Record<string, object>} submissions
 * @param {number} [now] epoch ms, injectable for tests
 * @returns {{ thisWeek: number, lastWeek: number, delta: number|null }}
 *   delta is the percentage change, or null when there is no prior week to
 *   compare against — a made-up 100% would be worse than saying nothing.
 */
export function weeklyCompletions(submissions, now = Date.now()) {
  const cutoffThis = now - 7 * DAY;
  const cutoffLast = now - 14 * DAY;

  let thisWeek = 0;
  let lastWeek = 0;

  Object.values(submissions || {}).forEach((sub) => {
    if (!DONE_STATUSES.has(sub?.status)) return;
    const t = submittedTime(sub);
    if (t === null || t > now) return;
    if (t >= cutoffThis) thisWeek += 1;
    else if (t >= cutoffLast) lastWeek += 1;
  });

  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  return { thisWeek, lastWeek, delta };
}

/**
 * Completions per day across the last seven days, oldest first — the shape a
 * small bar chart needs. Each entry is a real count, so an empty week draws
 * seven zeroes rather than a decorative curve.
 */
export function dailyCompletions(submissions, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() - (6 - i) * DAY);
    return { date: d, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 };
  });

  Object.values(submissions || {}).forEach((sub) => {
    if (!DONE_STATUSES.has(sub?.status)) return;
    const t = submittedTime(sub);
    if (t === null || t > now) return;
    const idx = days.findIndex((d) => t >= d.date.getTime() && t < d.date.getTime() + DAY);
    if (idx >= 0) days[idx].count += 1;
  });

  return days;
}
