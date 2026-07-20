import { BookOpen, Flame, FolderOpen, TrendingUp } from 'lucide-react';

export default function ProgressStatsBar({ stats, onStatClick }) {
  if (!stats?.length) return null;

  const icons = {
    programs: BookOpen,
    progress: TrendingUp,
    resources: FolderOpen,
    streak: Flame,
  };

  return (
    <div className="progress-stats dashboard-stats" role="list" aria-label="Progress overview">
      {stats.map(({ id, label, value, hint, targetId }) => {
        const Icon = icons[id] || TrendingUp;
        const clickable = Boolean(targetId && onStatClick);

        const content = (
          <>
            <span className="progress-stat__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="dashboard-stat__value">{value}</span>
            <span className="dashboard-stat__label">{label}</span>
            {hint && <span className="dashboard-stat__hint muted">{hint}</span>}
          </>
        );

        if (clickable) {
          return (
            <button
              key={id}
              type="button"
              className="progress-stat dashboard-stat progress-stat--link"
              role="listitem"
              onClick={() => onStatClick(targetId)}
              aria-label={`${label}: ${value}. ${hint || ''}`.trim()}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={id} className="progress-stat dashboard-stat" role="listitem">
            {content}
          </div>
        );
      })}
    </div>
  );
}
