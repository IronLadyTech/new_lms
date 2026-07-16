export default function CxQuickStats({ stats }) {
  if (!stats?.length) return null;

  return (
    <div className="cx-dashboard-stats" role="list" aria-label="CX overview">
      {stats.map(({ id, label, value }) => (
        <div key={id} className="cx-dashboard-stat" role="listitem">
          <span className="cx-dashboard-stat__value">{value}</span>
          <span className="cx-dashboard-stat__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
