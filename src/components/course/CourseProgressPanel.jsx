import { Link } from 'react-router-dom';
import { TASK_TYPES } from '../../services/mbwService';
import { getProgramProgressPct } from '../../utils/mbwProgramUtils';
import { getModuleLabel } from '../../utils/mbwDisplay';

function ProgressRing({ pct, label, size = 76 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;

  return (
    <div className="course-progress-ring" style={{ '--ring-size': `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
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
        <strong>{pct}%</strong>
        <span>{label}</span>
      </span>
    </div>
  );
}

function countTaskBuckets(taskStates) {
  let lessonsTotal = 0;
  let lessonsDone = 0;
  let tasksTotal = 0;
  let tasksDone = 0;

  taskStates.forEach((ts) => {
    const isLesson = ts.task.type === TASK_TYPES.WATCH_ONLY;
    if (isLesson) {
      lessonsTotal += 1;
      if (ts.isComplete) lessonsDone += 1;
    } else if (!ts.task.optional) {
      tasksTotal += 1;
      if (ts.isComplete) tasksDone += 1;
    }
  });

  return { lessonsTotal, lessonsDone, tasksTotal, tasksDone };
}

export default function CourseProgressPanel({
  completedMilestones,
  totalMilestones,
  nextTaskState,
  taskStates,
  resumeHref,
}) {
  const overallPct = getProgramProgressPct(completedMilestones, totalMilestones);
  const { lessonsTotal, lessonsDone, tasksTotal, tasksDone } = countTaskBuckets(taskStates || []);
  const lessonsPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
  const tasksPct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const nextTitle = nextTaskState?.task ? getModuleLabel(nextTaskState.task) : null;

  return (
    <aside className="course-progress-panel" aria-label="Your program progress">
      <div className="course-progress-panel__hero">
        <ProgressRing pct={overallPct} label="Overall" size={84} />
        <div className="course-progress-panel__summary">
          <p className="course-progress-panel__headline">
            You&apos;ve completed{' '}
            <strong>
              {completedMilestones} of {totalMilestones}
            </strong>{' '}
            milestones
          </p>
          {nextTitle && (
            <p className="course-progress-panel__next muted">
              Up next: <span>{nextTitle}</span>
            </p>
          )}
          {resumeHref && (
            <Link to={resumeHref} className="btn btn-primary course-progress-panel__cta">
              Continue to study
            </Link>
          )}
        </div>
      </div>

      <div className="course-progress-panel__stats">
        <h3 className="course-progress-panel__stats-title">Task progress</h3>
        <div className="course-progress-panel__stat-row">
          <ProgressRing pct={lessonsPct} label="Lessons" size={64} />
          <div className="course-progress-panel__stat-copy">
            <strong>Lesson videos</strong>
            <span className="muted">
              {lessonsDone} / {lessonsTotal} watched
            </span>
          </div>
        </div>
        <div className="course-progress-panel__stat-row">
          <ProgressRing pct={tasksPct} label="Tasks" size={64} />
          <div className="course-progress-panel__stat-copy">
            <strong>Assignments</strong>
            <span className="muted">
              {tasksDone} / {tasksTotal} submitted
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
