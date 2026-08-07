import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * KPI strip.
 *
 * A tile is either read-only (monitoring) or actionable (navigates to the queue that
 * clears it) — never ambiguously both. Actionable tiles carry a visible action label
 * and chevron so the affordance is legible without hovering; read-only tiles have no
 * interactive styling at all. Callers group tiles by intent rather than mixing them.
 */
export default function CxKpiStrip({ items, loading = false }) {
  if (loading) {
    return (
      <div className="cx-kpi-strip" aria-busy="true" aria-label="Loading metrics">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cx-kpi cx-kpi--skeleton" />
        ))}
      </div>
    );
  }

  if (!items?.length) return null;

  return (
    <ul className="cx-kpi-strip">
      {items.map(({ id, label, value, hint, icon: Icon, to, onClick, tone, actionLabel }) => {
        const interactive = Boolean(to || onClick);
        const className = [
          'cx-kpi',
          tone ? `cx-kpi--${tone}` : '',
          interactive ? 'cx-kpi--interactive' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const inner = (
          <>
            {Icon && (
              <span className="cx-kpi__icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2} />
              </span>
            )}
            <span className="cx-kpi__body">
              <span className="cx-kpi__value">{value}</span>
              <span className="cx-kpi__label">{label}</span>
              {hint && <span className="cx-kpi__hint muted">{hint}</span>}
            </span>
            {interactive && (
              <span className="cx-kpi__action">
                {actionLabel && <span className="cx-kpi__action-label">{actionLabel}</span>}
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            )}
          </>
        );

        return (
          <li key={id} className="cx-kpi-strip__item">
            {to ? (
              <Link to={to} className={className}>
                {inner}
              </Link>
            ) : onClick ? (
              <button type="button" className={className} onClick={onClick}>
                {inner}
              </button>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
