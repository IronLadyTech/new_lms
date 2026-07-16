import { Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStreakAnalytics } from '../hooks/useStreakAnalytics';

/**
 * Compact streak ring for the app header (Behance "Non-stop studying" motif),
 * using REAL streak data: current streak (number) with the ring filling toward
 * the learner's personal best. No invented goal denominator.
 */
export default function HeaderStreak() {
  const { user, isGuest } = useAuth();
  const { summary } = useStreakAnalytics(isGuest ? null : user?.uid);

  if (isGuest || !user) return null;

  const streak = summary?.currentStreak || 0;
  const best = summary?.longestStreak?.days || 0;
  const pct = best > 0 ? Math.min(100, Math.round((streak / best) * 100)) : streak > 0 ? 100 : 0;

  const size = 36;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const title = best > 0 ? `${streak}-day streak · personal best ${best}` : `${streak}-day streak`;

  return (
    <div
      className="header-streak"
      title={title}
      role="img"
      aria-label={`Current streak ${streak} day${streak === 1 ? '' : 's'}${
        best > 0 ? `, personal best ${best} days` : ''
      }`}
    >
      <span className="header-streak__ring">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            className="header-streak__track"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
          />
          <circle
            className="header-streak__fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        {streak > 0 ? (
          <span className="header-streak__num">{streak}</span>
        ) : (
          <Flame size={14} className="header-streak__flame" aria-hidden="true" />
        )}
      </span>
      <span className="header-streak__meta">
        <span>day{streak === 1 ? '' : 's'}</span>
        <span>streak</span>
      </span>
    </div>
  );
}
