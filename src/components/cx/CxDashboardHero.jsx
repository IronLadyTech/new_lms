import { getProgramLabel } from '../../data/programTypes';

export default function CxDashboardHero({ firstName, program, adapter }) {
  return (
    <section className="cx-dashboard-hero" aria-label="CX welcome">
      <div className="cx-dashboard-hero__copy">
        <p className="cx-dashboard-hero__eyebrow">
          Customer Experience
          <span className="cx-program-badge">{adapter.shortLabel}</span>
        </p>
        <h1 className="cx-dashboard-hero__title">Hi, {firstName || 'there'}</h1>
        <p className="cx-dashboard-hero__tagline">{getProgramLabel(program)}</p>
        <p className="cx-dashboard-hero__sub muted">
          Reviews, reminders, and cohort tracking for your {adapter.shortLabel} learners.
        </p>
      </div>
    </section>
  );
}
