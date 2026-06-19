import { Lightbulb } from 'lucide-react';

export default function AnalyticsInsights({ insights = [], streakBroken, onResume }) {
  if (!insights.length && !streakBroken) return null;

  return (
    <div className="streak-insights">
      {streakBroken && onResume && (
        <div className="streak-nudge" role="status">
          <p>Your streak was reset. Pick a course and submit today to restart.</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={onResume}>
            Resume practice
          </button>
        </div>
      )}
      {insights.length > 0 && (
        <ul className="streak-insights__list">
          {insights.map((text) => (
            <li key={text}>
              <Lightbulb size={16} aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
