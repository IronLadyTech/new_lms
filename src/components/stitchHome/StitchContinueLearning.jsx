import { Link } from 'react-router-dom';

export default function StitchContinueCard({ data }) {
  if (!data) return null;

  return (
    <section className="sh-card">
      <p className="sh-eyebrow">{data.eyebrow}</p>
      <h2 className="sh-card-title">{data.title}</h2>
      <p className="sh-card-sub">{data.nextLabel}</p>
      <div className="sh-progress-row">
        <div className="sh-progress-track" role="presentation">
          <div className="sh-progress-fill" style={{ width: `${data.progressPct}%` }} />
        </div>
        <span className="sh-progress-label">{data.progressLabel}</span>
      </div>
      <Link className="sh-btn-primary sh-continue__cta" to={data.href || '#'}>
        {data.ctaLabel}
      </Link>
    </section>
  );
}
