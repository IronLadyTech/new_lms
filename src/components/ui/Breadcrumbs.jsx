import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Accessible breadcrumb trail — items: { label, href? } (last item = current page).
 */
export default function Breadcrumbs({ items = [], className = '' }) {
  if (!items.length) return null;

  return (
    <nav className={`breadcrumbs ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="breadcrumbs__item">
              {index > 0 && (
                <ChevronRight size={14} className="breadcrumbs__sep" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span className="breadcrumbs__current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.href} className="breadcrumbs__link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
