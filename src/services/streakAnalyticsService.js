import {
  getDateKey,
  getTodayKey,
  addDaysToKey,
  daysBetweenKeys,
  enumerateDateKeys,
  formatDisplayDate,
  getMonthLabel,
  parseDateKey,
} from '../utils/streakTimezone';

/** A qualifying submission counts toward streak when isCorrect is true. */
export const QUALIFYING_RULE =
  'A calendar day counts when the learner has at least one correct submission (Asia/Kolkata).';

function eventDateKey(event) {
  if (event.dateKey) return event.dateKey;
  const ts = event.timestamp;
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : getDateKey(d);
}

function qualifyingEvents(events) {
  return events.filter((e) => e.isCorrect === true && eventDateKey(e));
}

function buildDailyCounts(events) {
  const map = new Map();
  qualifyingEvents(events).forEach((e) => {
    const key = eventDateKey(e);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function computeCurrentStreak(activeDateSet) {
  if (!activeDateSet.size) return 0;
  const today = getTodayKey();
  let cursor = today;
  if (!activeDateSet.has(cursor)) {
    cursor = addDaysToKey(today, -1);
  }
  let streak = 0;
  while (activeDateSet.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}

function computeLongestStreak(sortedDateKeys) {
  if (!sortedDateKeys.length) {
    return { days: 0, start: null, end: null };
  }
  let best = { days: 1, start: sortedDateKeys[0], end: sortedDateKeys[0] };
  let runStart = sortedDateKeys[0];
  let runLen = 1;

  for (let i = 1; i < sortedDateKeys.length; i += 1) {
    const prev = sortedDateKeys[i - 1];
    const cur = sortedDateKeys[i];
    if (daysBetweenKeys(prev, cur) === 1) {
      runLen += 1;
    } else {
      if (runLen > best.days) {
        best = { days: runLen, start: runStart, end: sortedDateKeys[i - 1] };
      }
      runStart = cur;
      runLen = 1;
    }
  }
  if (runLen > best.days) {
    best = { days: runLen, start: runStart, end: sortedDateKeys[sortedDateKeys.length - 1] };
  }
  return best;
}

function computeQualityRatio(events) {
  const total = events.length;
  if (!total) return { correct: 0, total: 0, ratio: null };
  const correct = events.filter((e) => e.isCorrect).length;
  return { correct, total, ratio: Math.round((correct / total) * 100) };
}

function computeTrends(dailyCounts) {
  if (!dailyCounts.length) {
    return { mostActiveMonths: [], dropOffAfter: null, activeSpan: null };
  }

  const byMonth = {};
  dailyCounts.forEach(({ date, count }) => {
    const month = date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + count;
  });

  const mostActiveMonths = Object.entries(byMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([month, count]) => {
      const [y, m] = month.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
      return { month, label, count };
    });

  const sortedDates = dailyCounts.map((d) => d.date);
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];
  const today = getTodayKey();

  let dropOffAfter = null;
  if (last < today) {
    const gap = daysBetweenKeys(last, today);
    if (gap >= 14) {
      dropOffAfter = formatDisplayDate(addDaysToKey(last, 1));
    }
  }

  const activeSpan =
    first && last
      ? `${formatDisplayDate(first)} – ${formatDisplayDate(last)}`
      : null;

  return { mostActiveMonths, dropOffAfter, activeSpan };
}

function generateInsights(summary) {
  const insights = [];
  const { currentStreak, longestStreak, daysSinceLastActivity, consistencyScore, trends, quality } =
    summary;

  if (currentStreak === 0 && daysSinceLastActivity != null && daysSinceLastActivity >= 30) {
    insights.push(`Streak reset — last active ${daysSinceLastActivity}+ days ago.`);
  } else if (currentStreak >= 7) {
    insights.push(`You're on a ${currentStreak}-day roll — keep the momentum going!`);
  } else if (currentStreak >= 1) {
    insights.push(`${currentStreak}-day streak active — submit today to extend it.`);
  }

  if (longestStreak.days > 0 && currentStreak >= longestStreak.days) {
    insights.push('New personal best streak — congratulations!');
  }

  if (trends.mostActiveMonths.length > 0) {
    const top = trends.mostActiveMonths[0];
    insights.push(`Most active month: ${top.label} (${top.count} correct submissions).`);
  }

  if (trends.dropOffAfter) {
    insights.push(`Activity dropped off after ${trends.dropOffAfter}.`);
  }

  if (quality.ratio != null && quality.ratio < 60 && quality.total >= 5) {
    insights.push(`Submission accuracy is ${quality.ratio}% — review missed problems.`);
  }

  if (consistencyScore != null && consistencyScore >= 50) {
    insights.push(`Consistency score: ${consistencyScore}% of days in range had practice.`);
  }

  return insights.slice(0, 4);
}

/**
 * Single calculation path for live + backfill data.
 * @param {Array} events - merged submission events
 * @param {{ rangeStart?: string, rangeEnd?: string }} options
 */
export function computeStreakSummary(events = [], options = {}) {
  const rangeEnd = options.rangeEnd || getTodayKey();
  const rangeStart =
    options.rangeStart || addDaysToKey(rangeEnd, -364);

  const dailyCounts = buildDailyCounts(events);
  const activeDates = new Set(dailyCounts.map((d) => d.date));
  const sortedActive = [...activeDates].sort();

  const currentStreak = computeCurrentStreak(activeDates);
  const longest = computeLongestStreak(sortedActive);

  const correctEvents = qualifyingEvents(events);
  const correctDateKeys = correctEvents
    .map((e) => eventDateKey(e))
    .filter(Boolean)
    .sort();
  const totalCorrect = correctEvents.length;
  const totalStart = correctDateKeys[0] || null;
  const totalEnd = correctDateKeys[correctDateKeys.length - 1] || null;

  const rangeDays = enumerateDateKeys(rangeStart, rangeEnd);
  const activeInRange = rangeDays.filter((d) => activeDates.has(d)).length;
  const consistencyScore =
    rangeDays.length > 0 ? Math.round((activeInRange / rangeDays.length) * 100) : null;

  const lastActive = sortedActive.length ? sortedActive[sortedActive.length - 1] : null;
  const daysSinceLastActivity = lastActive ? daysBetweenKeys(lastActive, getTodayKey()) : null;

  const trends = computeTrends(dailyCounts);
  const quality = computeQualityRatio(events);

  const base = {
    currentStreak,
    longestStreak: {
      days: longest.days,
      start: longest.start,
      end: longest.end,
    },
    totalCorrect: {
      count: totalCorrect,
      start: totalStart,
      end: totalEnd,
    },
    dailyCounts,
    consistencyScore,
    daysSinceLastActivity,
    trends,
    quality,
    timezone: 'Asia/Kolkata',
    qualifyingRule: QUALIFYING_RULE,
  };

  return {
    ...base,
    insights: generateInsights(base),
  };
}

/** Heatmap intensity level 0–5 from daily correct count (Tap-style gradient). */
export function heatmapLevel(count) {
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 4;
  return 5;
}

export const HEATMAP_LEGEND = [
  { level: 1, label: 'Low' },
  { level: 2, label: '' },
  { level: 3, label: '' },
  { level: 4, label: '' },
  { level: 5, label: 'High' },
];

/** Build GitHub-style weeks for the last ~52 weeks. */
export function buildHeatmapWeeks(dailyCounts, weeks = 52) {
  const countMap = new Map(dailyCounts.map((d) => [d.date, d.count]));
  const today = getTodayKey();
  const end = parseDateKey(today);
  end.setUTCDate(end.getUTCDate() - end.getUTCDay());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);

  const monthLabels = [];
  const grid = [];
  let cursor = new Date(start);
  let lastMonth = '';

  while (cursor <= end) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      const key = getDateKey(cursor);
      const count = countMap.get(key) || 0;
      week.push({
        date: key,
        count,
        level: heatmapLevel(count),
        weekday: cursor.getUTCDay(),
      });
      const month = getMonthLabel(cursor);
      if (month !== lastMonth && cursor.getUTCDay() === 0) {
        monthLabels.push({ label: month, weekIndex: grid.length });
        lastMonth = month;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    grid.push(week);
  }

  return { weeks: grid, monthLabels };
}

export function formatDateRange(start, end) {
  if (!start && !end) return '—';
  if (start && end && start === end) return formatDisplayDate(start);
  if (start && end) return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  if (start) return `From ${formatDisplayDate(start)}`;
  return `Until ${formatDisplayDate(end)}`;
}

export function streakMotivation(currentStreak) {
  if (currentStreak <= 0) return 'Start today — one submission begins your streak.';
  if (currentStreak === 1) return 'Great start! Come back tomorrow to build momentum.';
  if (currentStreak < 7) return 'Keep going — consistency beats intensity.';
  if (currentStreak < 30) return 'Strong habit forming. You are unstoppable!';
  return 'Legendary consistency — you are leading by example.';
}
