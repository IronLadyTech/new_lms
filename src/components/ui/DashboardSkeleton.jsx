export default function DashboardSkeleton({ rows = 2 }) {
  return (
    <div className="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="dashboard-skeleton__hero dashboard-skeleton__block" />
      <div className="dashboard-skeleton__stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dashboard-skeleton__stat dashboard-skeleton__block" />
        ))}
      </div>
      <div className="dashboard-skeleton__row">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="dashboard-skeleton__panel dashboard-skeleton__block" />
        ))}
      </div>
    </div>
  );
}
