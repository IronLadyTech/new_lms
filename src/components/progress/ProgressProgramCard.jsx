import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CourseThumbnail from '../CourseThumbnail';
import { getProgramTasksPath } from '../../utils/programTaskRoutes';

function ProgressRing({ pct, size = 52 }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safePct = Math.min(100, Math.max(0, pct));
  const offset = c - (safePct / 100) * c;

  return (
    <div
      className="course-progress-ring progress-program-card__ring"
      style={{ '--ring-size': `${size}px` }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="course-progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="course-progress-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="course-progress-ring__label">
        <strong>{safePct}%</strong>
      </span>
    </div>
  );
}

export default function ProgressProgramCard({
  course,
  pct = 0,
  label = '',
  loading = false,
  href,
  ctaLabel = 'Continue',
}) {
  const codeKey = (course.code || '').toLowerCase();
  const tasksPath = getProgramTasksPath(course.code);
  const actionHref = tasksPath || href;

  return (
    <article className={`progress-program-card progress-program-card--${codeKey}`}>
      <div className="progress-program-card__media">
        <CourseThumbnail course={course} size="card" className="progress-program-card__thumb" />
      </div>

      <div className="progress-program-card__body">
        <h3 className="progress-program-card__title">{course.title}</h3>
        <p className="progress-program-card__label muted">
          {loading ? 'Loading progress…' : label}
        </p>

        <div className="progress-program-card__metrics">
          <ProgressRing pct={loading ? 0 : pct} />
          <div className="progress-program-card__bar" aria-hidden={loading}>
            <div className="course-card__progress-bar">
              <div
                className="course-card__progress-fill"
                style={{ width: loading ? '0%' : `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {actionHref && (
          <Link to={actionHref} className="btn btn-primary btn-sm progress-program-card__cta">
            {ctaLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
