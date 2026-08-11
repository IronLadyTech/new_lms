import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getSubmissionReviewDisplay } from '../../utils/submissionReview';
import { formatActivityAge } from '../../utils/cxAnalytics';

export default function CxActivityFeed({ items, loading, emptyMessage }) {
  if (loading) {
    return (
      <ul className="cx-activity-feed" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="cx-activity-feed__item cx-activity-feed__item--skeleton" />
        ))}
      </ul>
    );
  }

  if (!items?.length) {
    return (
      <p className="muted cx-activity-feed__empty">{emptyMessage || 'No recent activity yet.'}</p>
    );
  }

  return (
    <ul className="cx-activity-feed">
      {items.map((item) => {
        const display = item.status ? getSubmissionReviewDisplay({ status: item.status }) : null;
        return (
          <li key={item.id} className="cx-activity-feed__item">
            <div className="cx-activity-feed__main">
              <span className="cx-activity-feed__who">
                {item.learner.displayName || item.learner.email}
              </span>
              <span className="cx-activity-feed__what">{item.label}</span>
            </div>
            <div className="cx-activity-feed__meta">
              {display && (
                <span className={`mbw-status-pill mbw-status-pill--${display.tone}`}>
                  {display.label}
                </span>
              )}
              <span className="muted">{formatActivityAge(item.ms)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CxActivityFeedFooter({ to, label }) {
  if (!to) return null;
  return (
    <div className="cx-panel__foot">
      <Link to={to} className="cx-panel__link">
        {label}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
