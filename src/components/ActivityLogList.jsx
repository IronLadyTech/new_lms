import { formatActivitySummary, formatActivityTypeLabel } from '../utils/activityLabels';

function formatWhen(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function ActivityLogList({
  activities = [],
  courseMap = {},
  emptyMessage = 'No activity yet.',
}) {
  const sortedActivities = [...activities].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const tb = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return tb - ta;
  });

  if (sortedActivities.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <ul className="activity-list">
      {sortedActivities.map((a) => (
        <li key={a.id} className="activity-list__item">
          <span className="activity-type">{formatActivityTypeLabel(a.type)}</span>
          <div className="activity-list__body">
            <span className="activity-list__summary">
              {formatActivitySummary(a, { courseMap })}
            </span>
            {a.createdAt && (
              <span className="activity-list__when muted">{formatWhen(a.createdAt)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function buildCourseMap(courses) {
  return Object.fromEntries((courses || []).map((c) => [c.id, c]));
}
