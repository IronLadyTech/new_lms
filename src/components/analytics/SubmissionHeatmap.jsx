import { useMemo } from 'react';
import { Share2 } from 'lucide-react';
import { buildHeatmapWeeks } from '../../services/streakAnalyticsService';
import { formatDisplayDate, getTodayKey } from '../../utils/streakTimezone';

const WEEKDAY_LABELS = ['Sun', 'Mon', '', 'Wed', '', 'Fri', ''];
const LEGEND_LEVELS = [1, 2, 3, 4, 5];

export default function SubmissionHeatmap({ dailyCounts = [], loading }) {
  const today = getTodayKey();
  const { weeks, monthLabels } = useMemo(
    () => buildHeatmapWeeks(dailyCounts, 52),
    [dailyCounts]
  );

  const handleShare = async () => {
    const text = `My submission streak on LMS — ${dailyCounts.reduce((s, d) => s + d.count, 0)} correct submissions!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Submission Streak', text, url: window.location.href });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="streak-heatmap-card streak-heatmap-card--loading" aria-busy="true">
        <div className="streak-skeleton streak-skeleton--heatmap" />
      </div>
    );
  }

  return (
    <div className="streak-heatmap-card">
      <div className="streak-heatmap-card__head">
        <h3 className="streak-heatmap-card__title">Submission Streak</h3>
        <button
          type="button"
          className="streak-heatmap-card__share"
          onClick={handleShare}
          aria-label="Share submission streak"
        >
          <Share2 size={18} />
        </button>
      </div>

      {!dailyCounts.length ? (
        <p className="streak-empty streak-empty--inline">
          No submissions yet — start practicing to build your streak.
        </p>
      ) : (
        <>
          <div className="streak-heatmap__scroll" role="img" aria-label="Submission activity heatmap">
            <div className="streak-heatmap__months" aria-hidden>
              {weeks.map((_, wi) => {
                const label = monthLabels.find((m) => m.weekIndex === wi);
                return (
                  <span key={`m-${wi}`} className="streak-heatmap__month">
                    {label?.label || ''}
                  </span>
                );
              })}
            </div>
            <div className="streak-heatmap__grid-wrap">
              <div className="streak-heatmap__weekdays" aria-hidden>
                {WEEKDAY_LABELS.map((lbl, i) => (
                  <span key={i} className="streak-heatmap__weekday">
                    {lbl}
                  </span>
                ))}
              </div>
              <div className="streak-heatmap__grid">
                {weeks.map((week, wi) => (
                  <div key={`w-${wi}`} className="streak-heatmap__week-col">
                    {week.map((cell) => (
                      <button
                        key={cell.date}
                        type="button"
                        className={`streak-heatmap__cell streak-heatmap__cell--l${cell.level}${
                          cell.date === today ? ' streak-heatmap__cell--today' : ''
                        }`}
                        title={
                          cell.count > 0
                            ? `${cell.count} correct submission${cell.count > 1 ? 's' : ''} on ${formatDisplayDate(cell.date)}`
                            : `No practice on ${formatDisplayDate(cell.date)}`
                        }
                        aria-label={
                          cell.count > 0
                            ? `${cell.count} correct submissions on ${formatDisplayDate(cell.date)}`
                            : `No practice on ${formatDisplayDate(cell.date)}`
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="streak-heatmap__legend" aria-hidden>
            <span className="streak-heatmap__legend-label">No Practice</span>
            <span className="streak-heatmap__legend-scale">
              {LEGEND_LEVELS.map((level) => (
                <span
                  key={level}
                  className={`streak-heatmap__cell streak-heatmap__cell--l${level}`}
                />
              ))}
            </span>
            <span className="streak-heatmap__legend-label">More Practice</span>
          </div>
        </>
      )}
    </div>
  );
}
