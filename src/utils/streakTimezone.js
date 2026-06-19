/** Canonical timezone for streak / attendance calendar days (Iron Lady LMS). */
export const STREAK_TIMEZONE = 'Asia/Kolkata';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STREAK_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STREAK_TIMEZONE,
  month: 'short',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STREAK_TIMEZONE,
  weekday: 'short',
});

/** Returns YYYY-MM-DD in the canonical timezone. */
export function getDateKey(date = new Date(), timeZone = STREAK_TIMEZONE) {
  const parts = dateKeyFormatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function getTodayKey(timeZone = STREAK_TIMEZONE) {
  return getDateKey(new Date(), timeZone);
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDaysToKey(key, delta) {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + delta);
  return getDateKey(d);
}

export function getMonthLabel(date, timeZone = STREAK_TIMEZONE) {
  return monthFormatter.format(date);
}

export function getWeekdayLabel(date, timeZone = STREAK_TIMEZONE) {
  return weekdayFormatter.format(date);
}

export function getWeekdayIndex(date, timeZone = STREAK_TIMEZONE) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

export function isWeekendKey(key, timeZone = STREAK_TIMEZONE) {
  const idx = getWeekdayIndex(parseDateKey(key), timeZone);
  return idx === 0 || idx === 6;
}

export function formatDisplayDate(key) {
  const d = parseDateKey(key);
  return d.toLocaleDateString('en-IN', {
    timeZone: STREAK_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function daysBetweenKeys(startKey, endKey) {
  const start = parseDateKey(startKey).getTime();
  const end = parseDateKey(endKey).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

export function enumerateDateKeys(startKey, endKey) {
  const keys = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
}
