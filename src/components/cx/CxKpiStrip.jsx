import { Link } from 'react-router-dom';

/**
 * CRM-style KPI strip — icon, value, label, optional link target.
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
    <div className="cx-kpi-strip" role="list" aria-label="Overview metrics">
      {items.map(
        ({ id, label, value, hint, icon: Icon, to, onClick, tone, badge }) => {
          const className = `cx-kpi${tone ? ` cx-kpi--${tone}` : ''}${to || onClick ? ' cx-kpi--interactive' : ''}`;
          const inner = (
            <>
              {Icon && (
                <span className="cx-kpi__icon" aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </span>
              )}
              <span className="cx-kpi__body">
                <span className="cx-kpi__value-row">
                  <span className="cx-kpi__value">{value}</span>
                  {badge != null && badge > 0 && (
                    <span className="cx-kpi__badge">{badge}</span>
                  )}
                </span>
                <span className="cx-kpi__label">{label}</span>
                {hint && <span className="cx-kpi__hint muted">{hint}</span>}
              </span>
            </>
          );

          if (to) {
            return (
              <Link key={id} to={to} className={className} role="listitem">
                {inner}
              </Link>
            );
          }

          if (onClick) {
            return (
              <button key={id} type="button" className={className} onClick={onClick} role="listitem">
                {inner}
              </button>
            );
          }

          return (
            <div key={id} className={className} role="listitem">
              {inner}
            </div>
          );
        }
      )}
    </div>
  );
}
