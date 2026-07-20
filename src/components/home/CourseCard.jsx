import { Link } from 'react-router-dom';
import { Clock, Layers } from 'lucide-react';
import CourseThumbnail from '../CourseThumbnail';
import { getCourseProgramMeta, getProgramCoverSrc, getProgramMarketingUrl } from '../../utils/courseDisplay';
import { getProgramTasksPath } from '../../utils/programTaskRoutes';
import { PROGRAM_ACCESS } from '../../utils/programAccess';

export default function CourseCard({
  course,
  access = null,
  progress = null,
}) {
  const meta = getCourseProgramMeta(course.code);
  const codeKey = (course.code || '').toLowerCase();
  const tasksPath = getProgramTasksPath(course.code);
  const courseHref = `/app/course/${course.id}`;
  const state = access?.state || (access?.canAccess ? PROGRAM_ACCESS.OPEN : PROGRAM_ACCESS.LOCKED);
  const canAccess = access?.canAccess ?? false;
  const locked = !canAccess;
  const hasBrandCover = Boolean(getProgramCoverSrc(course.code));
  const marketingUrl = getProgramMarketingUrl(course.code);

  return (
    <article
      className={`course-card course-card--rich course-card--stacked course-card--${codeKey}${
        locked ? ' course-card--locked' : ''
      }${state === PROGRAM_ACCESS.UPCOMING ? ' course-card--upcoming' : ''}${
        hasBrandCover ? ' course-card--brand-cover' : ''
      }`}
    >
      <div className="course-card__media">
        <CourseThumbnail course={course} size="card" />
      </div>

      <div className="course-card__body">
        <h3 className="course-card__title">{course.title}</h3>
        <p className="course-card__desc">{course.description}</p>

        <ul className="course-card__meta" aria-label="Program details">
          <li>
            <Clock size={14} aria-hidden />
            {meta.duration}
          </li>
          <li>
            <Layers size={14} aria-hidden />
            {meta.format}
          </li>
        </ul>

        {canAccess && progress && (
          <div className="course-card__progress" aria-label={`${progress.pct}% — ${progress.label}`}>
            <div className="course-card__progress-bar">
              <div
                className="course-card__progress-fill"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="course-card__progress-label">{progress.label}</span>
          </div>
        )}

        <div className="course-card__actions">
          {canAccess ? (
            <Link to={tasksPath || courseHref} className="btn btn-primary btn-sm">
              {tasksPath ? 'Open tasks' : 'Continue'}
            </Link>
          ) : marketingUrl ? (
            <a
              className="btn btn-primary btn-sm"
              href={marketingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View program
            </a>
          ) : (
            <Link to={courseHref} className="btn btn-primary btn-sm">
              View program
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
