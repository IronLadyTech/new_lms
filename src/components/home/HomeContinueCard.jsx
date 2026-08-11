import { Link } from 'react-router-dom';
import { getProgramTasksPath } from '../../utils/programTaskRoutes';

export default function HomeContinueCard({ course, nextLabel, enrolledCount, progress = null }) {
  if (!course) {
    return (
      <article className="dashboard-continue dashboard-continue--empty">
        <h2 className="dashboard-panel__title">Continue learning</h2>
        <p className="muted">
          {enrolledCount > 0
            ? 'Choose a program below to pick up where you left off.'
            : 'Enroll in a program to start your leadership journey.'}
        </p>
      </article>
    );
  }

  const tasksPath = getProgramTasksPath(course.code);
  const href = tasksPath || `/app/course/${course.id}`;
  const tasksLabel =
    course.code === 'MBW'
      ? 'Open MBW tasks'
      : course.code === '100BM'
        ? 'Open 100BM tasks'
        : 'Continue course';

  return (
    <article className="dashboard-continue">
      <p className="dashboard-continue__eyebrow">Continue learning</p>
      <h2 className="dashboard-continue__title">{course.title}</h2>
      {nextLabel && <p className="dashboard-continue__next muted">{nextLabel}</p>}
      {progress && (
        <div
          className="dashboard-continue__progress"
          aria-label={`${progress.pct}% — ${progress.label}`}
        >
          <div className="course-card__progress-bar">
            <div className="course-card__progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="course-card__progress-label">{progress.label}</span>
        </div>
      )}
      <Link to={href} className="btn btn-primary btn-sm dashboard-continue__btn">
        {tasksPath ? tasksLabel : 'Continue course'}
      </Link>
    </article>
  );
}
