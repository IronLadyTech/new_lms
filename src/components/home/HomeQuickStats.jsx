export default function HomeQuickStats({ stats }) {
  if (!stats?.length) return null;

  return (
    <div className="dashboard-stats" role="list" aria-label="Quick overview">
      {stats.map(({ id, label, value, hint }) => (
        <div key={id} className="dashboard-stat" role="listitem">
          <span className="dashboard-stat__value">{value}</span>
          <span className="dashboard-stat__label">{label}</span>
          {hint && <span className="dashboard-stat__hint muted">{hint}</span>}
        </div>
      ))}
    </div>
  );
}
