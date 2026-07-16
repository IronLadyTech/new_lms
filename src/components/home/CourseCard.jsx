import { Link } from 'react-router-dom';
import { Clock, Layers } from 'lucide-react';
import CourseThumbnail from '../CourseThumbnail';
import { getCourseProgramMeta } from '../../utils/courseDisplay';

import { getProgramTasksPath } from '../../utils/programTaskRoutes';

export default function CourseCard({ course, isEnrolled, onEnroll, progress = null }) {
  const meta = getCourseProgramMeta(course.code);
  const codeKey = (course.code || '').toLowerCase();
  const tasksPath = getProgramTasksPath(course.code);
  const courseHref = `/app/course/${course.id}`;

  return (
    <article className={`course-card course-card--rich course-card--${codeKey}`}>
      <div className="course-card__media">
        <CourseThumbnail course={course} size="card" />
        <span className={`course-card__code course-card__code--${codeKey}`}>{course.code}</span>
      </div>

      <div className="course-card__body">
        <div className="course-card__tags">
          <span className={`course-card__tag course-card__tag--${codeKey}`}>{meta.tag}</span>
          {isEnrolled && <span className="course-card__tag course-card__tag--enrolled">Enrolled</span>}
        </div>

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

        {isEnrolled && progress && (
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

        <div className="course-card__actions course-card__actions--dual">
          {isEnrolled ? (
            <>
              <Link to={courseHref} className="btn btn-outline btn-sm">
                View program
              </Link>
              <Link to={tasksPath || courseHref} className="btn btn-primary btn-sm">
                {tasksPath ? 'Open tasks' : 'Continue'}
              </Link>
            </>
          ) : (
            <>
              <Link to={`/app/course/${course.id}`} className="btn btn-outline btn-sm">
                Learn more
              </Link>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onEnroll(course.id, course.title)}>
                Enroll
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
