/**
 * PageHeader — shared page title block for student/CX pages.
 * Gives legacy `<h1>`-only pages the same eyebrow + title + subtitle
 * language as the redesigned dashboard hero.
 */
export default function PageHeader({ eyebrow, title, subtitle, actions, icon: Icon }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && (
          <p className="page-header__eyebrow">
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{eyebrow}</span>
          </p>
        )}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
