/**
 * SectionCard — shared white-surface card with optional titled header.
 * Consolidates the repeated card surface used by Profile/Support/Progress
 * so those pages stop reinventing border/radius/shadow styling.
 */
export default function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = '',
  as: Tag = 'section',
}) {
  const hasHeader = title || actions;
  return (
    <Tag className={`section-card ${className}`.trim()}>
      {hasHeader && (
        <div className="section-card__header">
          <div className="section-card__heading">
            {Icon && (
              <span className="section-card__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
            )}
            <div>
              {title && <h2 className="section-card__title">{title}</h2>}
              {description && <p className="section-card__desc">{description}</p>}
            </div>
          </div>
          {actions && <div className="section-card__actions">{actions}</div>}
        </div>
      )}
      <div className="section-card__body">{children}</div>
    </Tag>
  );
}
