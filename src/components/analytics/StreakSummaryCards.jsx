import { Award } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import { formatDateRange } from '../../services/streakAnalyticsService';

export default function StreakSummaryCards({ totalCorrect, longestStreak }) {
  return (
    <>
      <article className="streak-summary-card">
        <div className="streak-summary-card__icon" aria-hidden>
          <Award size={28} strokeWidth={1.75} />
        </div>
        <div className="streak-summary-card__body">
          <p className="streak-summary-card__value">
            <AnimatedNumber value={totalCorrect?.count || 0} />
          </p>
          <p className="streak-summary-card__dates">
            {formatDateRange(totalCorrect?.start, totalCorrect?.end)}
          </p>
          <p className="streak-summary-card__label">Total Correct Submissions</p>
        </div>
      </article>

      <article className="streak-summary-card">
        <div className="streak-summary-card__icon" aria-hidden>
          <Award size={28} strokeWidth={1.75} />
        </div>
        <div className="streak-summary-card__body">
          <p className="streak-summary-card__value">
            <AnimatedNumber value={longestStreak?.days || 0} />
          </p>
          <p className="streak-summary-card__dates">
            {formatDateRange(longestStreak?.start, longestStreak?.end)}
          </p>
          <p className="streak-summary-card__label">Longest Streak</p>
        </div>
      </article>
    </>
  );
}
