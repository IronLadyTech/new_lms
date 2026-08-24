import { Link } from 'react-router-dom';
import { getProgramTasksPath, getProgramLessonPath } from '../../utils/programTaskRoutes';

/**
 * `resume` is opt-in and defaults to null, so the original homepage — which
 * passes nothing — renders exactly as it did. Only the experimental clone opts
 * in. Without that the "isolated clone" would leak into the control it exists
 * to be measured against.
 */
export default function HomeContinueCard({
  course,
  nextLabel,
  enrolledCount,
  progress = null,
  resume = null,
}) {
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
  /*
   * Straight to the task when we know it. "Open MBW tasks" names the container
   * the learner is already in and leaves them to find the work; the task's own
   * name and a Start button remove a screen and a decision.
   */
  const resumeHref = resume?.taskId
    ? getProgramLessonPath(course.code, resume.taskId)
    : null;
  const href = resumeHref || tasksPath || `/app/course/${course.id}`;
  const tasksLabel = resume?.taskId
    ? 'Start'
    : course.code === 'MBW'
      ? 'Open MBW tasks'
      : course.code === '100BM'
        ? 'Open 100BM tasks'
        : 'Continue course';

  return (
    <article className="dashboard-continue">
      <p className="dashboard-continue__eyebrow">Continue learning</p>
      <h2 className="dashboard-continue__title">
        {resume?.title || course.title}
      </h2>
      {/*
        * With a task named, the programme becomes the context line rather than
        * the headline — the learner knows which programme they are in, and does
        * not know which task is next.
        */}
      {resume?.title ? (
        <p className="dashboard-continue__next muted">
          {course.title}
          {resume.section ? ` · ${resume.section}` : ''}
        </p>
      ) : (
        nextLabel && <p className="dashboard-continue__next muted">{nextLabel}</p>
      )}
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
