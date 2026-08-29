import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { weeklyCompletions, dailyCompletions } from '../../utils/weeklyActivity';

/**
 * What the learner finished in the last seven days.
 *
 * Stands where the prototype put "Hours spent", which could not be built: the
 * product records a watch percentage per lesson and never a duration, so any
 * hours figure would have been invented. Completions come from submissions
 * that exist, and answer the same question — am I moving?
 */
export default function HomeWeeklyActivity({ submissions }) {
  const { thisWeek, lastWeek, delta } = useMemo(
    () => weeklyCompletions(submissions),
    [submissions]
  );
  const days = useMemo(() => dailyCompletions(submissions), [submissions]);
  const peak = Math.max(1, ...days.map((d) => d.count));

  const Trend = delta === null ? null : delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <section className="weekly-activity" aria-labelledby="weekly-activity-title">
      <div className="weekly-activity__head">
        <h2 id="weekly-activity-title" className="weekly-activity__title">
          This week
        </h2>
        {/*
          A percentage only appears once there is a real week to compare with.
          A first week is not "up 100%" — there is nothing to be up from.
        */}
        {Trend && (
          <span
            className={`weekly-activity__trend${delta >= 0 ? '' : ' weekly-activity__trend--down'}`}
          >
            <Trend size={14} aria-hidden />
            {Math.abs(delta)}%
            <span className="sr-only"> compared with last week</span>
          </span>
        )}
      </div>

      <p className="weekly-activity__figure">
        <span className="weekly-activity__count">{thisWeek}</span>
        <span className="weekly-activity__unit">
          {thisWeek === 1 ? 'lesson completed' : 'lessons completed'}
        </span>
      </p>

      <ol className="weekly-activity__chart" aria-hidden>
        {days.map((d) => (
          <li key={d.date.toISOString()} className="weekly-activity__day">
            <span
              className={`weekly-activity__bar${d.count === 0 ? ' is-empty' : ''}`}
              style={{ height: `${Math.round((d.count / peak) * 100)}%` }}
            />
            <span className="weekly-activity__day-label">{d.label.slice(0, 1)}</span>
          </li>
        ))}
      </ol>

      {/* The chart is decorative; this is the same data for a screen reader. */}
      <p className="sr-only">
        {days.map((d) => `${d.label}: ${d.count}`).join(', ')}.
        {lastWeek > 0 ? ` Last week: ${lastWeek}.` : ''}
      </p>

      {thisWeek === 0 && (
        <p className="weekly-activity__empty muted">
          Nothing finished yet this week — open a lesson to get going.
        </p>
      )}
    </section>
  );
}
