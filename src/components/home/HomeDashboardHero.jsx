import { Link } from 'react-router-dom';
import { getProgramShortLabel } from '../../data/programTypes';

const TAGLINE = 'Elevating a million women to the top';

export default function HomeDashboardHero({ greeting, firstName, program, subline, cta }) {
  const programLabel = program ? getProgramShortLabel(program) : null;

  return (
    <section className="dashboard-hero" aria-label="Welcome">
      <div className="dashboard-hero__copy">
        <p className="dashboard-hero__eyebrow">
          {greeting}
          {programLabel && (
            <span className={`dashboard-hero__program dashboard-hero__program--${program}`}>
              {programLabel}
            </span>
          )}
        </p>
        <h1 className="dashboard-hero__title">{firstName || 'Welcome back'}</h1>
        <p className="dashboard-hero__tagline">{TAGLINE}</p>
        {subline && <p className="dashboard-hero__sub muted">{subline}</p>}
      </div>
      {cta && <div className="dashboard-hero__cta">{cta}</div>}
    </section>
  );
}

export function HomeDashboardHeroCta({ to, onClick, children }) {
  if (to) {
    return (
      <Link to={to} className="btn btn-primary dashboard-hero__btn">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className="btn btn-primary dashboard-hero__btn" onClick={onClick}>
      {children}
    </button>
  );
}
