import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Zoho-style work queue panel for pending reviews, reminders, etc.
 */
export default function CxWorkQueue({
  title,
  count,
  emptyTitle,
  emptyMessage,
  viewAllTo,
  viewAllLabel,
  children,
  actions,
}) {
  return (
    <section className="cx-panel cx-work-queue" aria-labelledby={`${title}-heading`}>
      <div className="cx-panel__head">
        <div>
          <h2 id={`${title}-heading`} className="cx-panel__title">
            {title}
            {count != null && count > 0 && <span className="cx-panel__count">{count}</span>}
          </h2>
        </div>
        {actions}
      </div>
      <div className="cx-panel__body">
        {children || (
          <div className="cx-work-queue__empty">
            <p className="cx-work-queue__empty-title">{emptyTitle}</p>
            {emptyMessage && <p className="muted cx-work-queue__empty-msg">{emptyMessage}</p>}
          </div>
        )}
      </div>
      {viewAllTo && (
        <div className="cx-panel__foot">
          <Link to={viewAllTo} className="cx-panel__link">
            {viewAllLabel || 'View all'}
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
