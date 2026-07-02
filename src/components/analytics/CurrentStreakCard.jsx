import { Zap } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

function HexBadge({ value }) {
  const label = value === 1 ? 'Day' : 'Days';
  return (
    <div className="streak-hex-badge" aria-hidden>
      <svg viewBox="0 0 88 96" className="streak-hex-badge__shape">
        <defs>
          <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F52929" />
            <stop offset="100%" stopColor="#C8102E" />
          </linearGradient>
        </defs>
        <polygon
          points="44,4 80,24 80,64 44,84 8,64 8,24"
          fill="url(#hexGrad)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        <polygon
          points="44,12 72,28 72,60 44,76 16,60 16,28"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="streak-hex-badge__text">
        <span className="streak-hex-badge__num">
          <AnimatedNumber value={value} />
        </span>
        <span className="streak-hex-badge__unit">{label}</span>
      </div>
    </div>
  );
}

export default function CurrentStreakCard({ currentStreak = 0 }) {
  const dayPills =
    currentStreak > 0
      ? Array.from({ length: Math.min(currentStreak, 7) }, (_, i) => i + 1)
      : [];

  return (
    <article className="streak-current-panel">
      <div className="streak-current-panel__main">
        <div className="streak-current-panel__copy">
          <h3 className="streak-current-panel__title">Current Streak</h3>
          <p className="streak-current-panel__motivation">
            {currentStreak > 0 ? (
              <>
                Consistency is key! Keep upskilling for at least{' '}
                <strong>10 minutes</strong> each day to grow your streak.
              </>
            ) : (
              <>
                Consistency is key! Start your streak by upskilling for at least{' '}
                <strong>10 minutes</strong> each day.
              </>
            )}
          </p>
        </div>
        <HexBadge value={currentStreak} />
      </div>

      {dayPills.length > 0 && (
        <div className="streak-current-panel__days" aria-label="Recent streak days">
          {dayPills.map((day) => (
            <div key={day} className="streak-day-pill streak-day-pill--active">
              <Zap size={16} aria-hidden />
              <span>Day {day}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
