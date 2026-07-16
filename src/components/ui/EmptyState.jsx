/**
 * EmptyState — shared "no content yet" block with optional action.
 * Replaces the ad-hoc empty patterns scattered across pages.
 * Pass a Lucide icon component (not an emoji).
 */
export default function EmptyState({ icon: Icon, title, message, action, className = '' }) {
  return (
    <div className={`empty-state ${className}`.trim()} role="status">
      {Icon && (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={28} strokeWidth={1.75} />
        </span>
      )}
      {title && <p className="empty-state__title">{title}</p>}
      {message && <p className="empty-state__message">{message}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
