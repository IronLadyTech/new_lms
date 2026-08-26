import { Link } from 'react-router-dom';

/**
 * @param {object} props
 * @param {string} props.greeting
 * @param {string} [props.firstName]
 * @param {string} [props.subline]
 * @param {import('react').ReactNode} [props.cta]
 */
export default function HomeDashboardHero({ greeting, firstName, subline, cta }) {
  return (
    <section className="dashboard-hero" aria-label="Welcome">
      <div className="dashboard-hero__copy">
        <p className="dashboard-hero__eyebrow">{greeting}</p>
        {/*
         * The company line used to sit here, between the learner's name and
         * what they are meant to do next — so the one thing they came for was
         * interrupted by the one thing they had already been persuaded of. It
         * lives under the logo now, where a brand line belongs.
         */}
        <h1 className="dashboard-hero__title">{firstName || 'Welcome back'}</h1>
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
