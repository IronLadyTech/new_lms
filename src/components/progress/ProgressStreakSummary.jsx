import DashboardSkeleton from '../ui/DashboardSkeleton';

export default function ProgressStreakSummary({ summary, loading }) {
  if (loading) {
    return <DashboardSkeleton rows={1} />;
  }

  const stats = [
    { id: 'current', label: 'Current streak', value: summary?.currentStreak ?? 0, unit: 'days' },
    { id: 'best', label: 'Best streak', value: summary?.longestStreak?.days ?? 0, unit: 'days' },
    {
      id: 'submissions',
      label: 'Submissions',
      value: summary?.totalCorrect?.count ?? 0,
      unit: 'total',
    },
  ];

  return (
    <div className="progress-streak-numbers" role="list" aria-label="Streak summary">
      {stats.map(({ id, label, value, unit }) => (
        <div key={id} className="progress-streak-numbers__item" role="listitem">
          <span className="progress-streak-numbers__value" aria-label={`${label}: ${value}`}>
            {value}
          </span>
          <span className="progress-streak-numbers__label">{label}</span>
          <span className="progress-streak-numbers__unit muted">{unit}</span>
        </div>
      ))}
    </div>
  );
}
