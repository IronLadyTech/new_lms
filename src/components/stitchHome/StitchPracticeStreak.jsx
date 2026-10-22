import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import {
  heatmapLevel,
  QUALIFYING_RULE,
  HEATMAP_SHADE_RULE,
} from '../../services/streakAnalyticsService';
import { formatDisplayDate } from '../../utils/streakTimezone';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfWeekSunday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cellTooltipText(dateKey, count) {
  const label = formatDisplayDate(dateKey);
  if (!count) return `No submissions on ${label}`;
  if (count === 1) return `1 correct submission on ${label}`;
  return `${count} correct submissions on ${label}`;
}

function buildYearGrid(year, countByDate = {}) {
  const today = new Date();
  const todayKey = ymd(today);
  const yearStart = new Date(year, 0, 1);
  /* Always Jan–Dec so the current year matches past years (future days stay empty). */
  const yearEnd = new Date(year, 11, 31);

  let cursor = startOfWeekSunday(yearStart);
  const lastWeekStart = startOfWeekSunday(yearEnd);

  const weeks = [];
  const monthLabels = [];
  let lastLabeledMonth = null;

  while (cursor <= lastWeekStart) {
    const days = [];
    let weekMonthLabel = '';
    for (let d = 0; d < 7; d += 1) {
      const key = ymd(cursor);
      const inYear = cursor.getFullYear() === year;
      const future = key > todayKey;
      const count = inYear && !future ? countByDate[key] || 0 : 0;
      days.push({
        key,
        count,
        level: inYear && !future ? heatmapLevel(count) : 0,
        isToday: key === todayKey,
        empty: !inYear || future,
      });
      if (inYear && cursor.getDate() === 1 && cursor.getMonth() !== lastLabeledMonth) {
        weekMonthLabel = MONTHS[cursor.getMonth()];
        lastLabeledMonth = cursor.getMonth();
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    monthLabels.push(weekMonthLabel);
    weeks.push(days);
  }

  return { weeks, monthLabels };
}

function HowWeCountModal({ open, onClose, activeDays }) {
  const panelRef = useRef(null);
  useFocusTrap(open, panelRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sh-streak-modal" role="presentation">
      <button
        type="button"
        className="sh-streak-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="sh-streak-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sh-streak-count-title"
        ref={panelRef}
      >
        <div className="sh-streak-modal__head">
          <h3 id="sh-streak-count-title" className="sh-streak-modal__title">
            How your streak is counted
          </h3>
          <button
            type="button"
            className="sh-streak-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <ul className="sh-streak-modal__list">
          <li>
            <strong>A day counts:</strong> {QUALIFYING_RULE} LEP, 100BM, and MBW task
            submissions that qualify as correct count.
          </li>
          <li>
            <strong>Your streak:</strong> consecutive days with at least one correct
            submission. Miss a day and the streak resets to zero.
          </li>
          <li>
            <strong>Cell shades:</strong> {HEATMAP_SHADE_RULE}
          </li>
          <li>
            <strong>Active days:</strong> all-time days you practised
            ({activeDays}). This total never resets.
          </li>
        </ul>

        <p className="sh-streak-modal__tip">
          Tip: one focused submission a day is enough to keep the streak alive.
        </p>
      </div>
    </div>
  );
}

export default function StitchPracticeStreak({ streak }) {
  const [year, setYear] = useState(streak.activeYear);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    setYear(streak.activeYear);
  }, [streak.activeYear]);

  const countByDate = useMemo(() => {
    const map = {};
    (streak.dailyCounts || []).forEach((row) => {
      if (row?.date) map[row.date] = row.count || 0;
    });
    return map;
  }, [streak.dailyCounts]);

  const activeDays = useMemo(
    () => (streak.dailyCounts || []).filter((row) => (row.count || 0) > 0).length,
    [streak.dailyCounts],
  );

  const { weeks, monthLabels } = useMemo(
    () => buildYearGrid(year, countByDate),
    [year, countByDate],
  );

  const showTooltip = (day, event) => {
    if (day.empty) {
      setTooltip(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text: cellTooltipText(day.key, day.count),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  return (
    <section className="sh-streak sh-full" aria-label="Practice streak">
      <div className="sh-streak__head">
        <h2 className="sh-streak__title">Practice Streak</h2>
        <button type="button" className="sh-streak__share" aria-label="Share practice streak">
          <Share2 size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="sh-streak__metrics">
        <div className="sh-streak__metric sh-streak__metric--current">
          <p className="sh-streak__value">{streak.current}</p>
          <p className="sh-streak__label">Current streak</p>
        </div>
        <div className="sh-streak__metric">
          <p className="sh-streak__value">{streak.longest}</p>
          <p className="sh-streak__label">Longest streak</p>
        </div>
        <div className="sh-streak__metric">
          <p className="sh-streak__value">{streak.totalCorrect}</p>
          <p className="sh-streak__label">Total Correct submissions</p>
        </div>
      </div>

      <div className="sh-streak__toolbar">
        <div className="sh-streak__years" role="tablist" aria-label="Select year">
          {streak.years.map((y) => (
            <button
              key={y}
              type="button"
              role="tab"
              className={`sh-streak__year${y === year ? ' is-active' : ''}`}
              aria-selected={y === year}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="sh-streak__chart" role="img" aria-label={`Practice activity for ${year}`}>
        <div
          className="sh-streak__chart-inner"
          style={{ '--sh-streak-weeks': weeks.length }}
        >
          <div className="sh-streak__months" aria-hidden>
            {monthLabels.map((label, i) => (
              <span key={`m-${i}`} className="sh-streak__month">
                {label}
              </span>
            ))}
          </div>
          <div className="sh-streak__weekdays" aria-hidden>
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div className="sh-streak__grid">
            {weeks.map((week, wi) => (
              <div key={`w-${wi}`} className="sh-streak__week">
                {week.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className={[
                      'sh-streak__cell',
                      day.level ? `sh-streak__cell--l${day.level}` : '',
                      day.isToday ? 'sh-streak__cell--today' : '',
                      day.empty ? 'sh-streak__cell--empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={day.empty}
                    aria-label={
                      day.empty ? undefined : cellTooltipText(day.key, day.count)
                    }
                    onMouseEnter={(e) => showTooltip(day, e)}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={(e) => showTooltip(day, e)}
                    onBlur={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="sh-streak__tooltip"
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="sh-streak__foot">
        <div className="sh-streak__status">
          <span className="sh-streak__dot" aria-hidden />
          <span>{streak.todayStatus}</span>
        </div>
        <div className="sh-streak__foot-end">
          <button
            type="button"
            className="sh-streak__help"
            onClick={() => setHelpOpen(true)}
          >
            How we count
          </button>
          <div className="sh-streak__legend" aria-hidden>
            <span>Less</span>
            <span className="sh-streak__legend-scale">
              <span className="sh-streak__cell" />
              <span className="sh-streak__cell sh-streak__cell--l1" />
              <span className="sh-streak__cell sh-streak__cell--l2" />
              <span className="sh-streak__cell sh-streak__cell--l3" />
              <span className="sh-streak__cell sh-streak__cell--l4" />
            </span>
            <span>More</span>
          </div>
        </div>
      </div>

      <HowWeCountModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        activeDays={activeDays}
      />
    </section>
  );
}
