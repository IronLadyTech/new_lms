import { filterSavedTaskStates } from '../../utils/mbwSubmissionUtils';
import { getModuleLabel, submissionPreview } from '../../utils/mbwDisplay';

export default function MBWSubmissionsArchive({ taskStates, onOpenTask, compact = false }) {
  const saved = filterSavedTaskStates(taskStates);

  if (saved.length === 0) return null;

  return (
    <section className={`mbw-archive${compact ? ' mbw-archive--compact' : ''}`}>
      {!compact && (
        <>
          <h2>My submissions</h2>
          <p className="mbw-archive__sub">
            Everything you&apos;ve saved stays here — tap to view or edit.
          </p>
        </>
      )}
      <ul className="mbw-archive__list">
        {saved.map(({ task, submission, isComplete }) => (
          <li key={task.id}>
            <button type="button" className="mbw-archive__item" onClick={() => onOpenTask(task.id)}>
              <span className="mbw-archive__title">{getModuleLabel(task)}</span>
              <span className="mbw-archive__preview">{submissionPreview(submission, task)}</span>
              <span className={`mbw-archive__badge${isComplete ? ' is-done' : ''}`}>
                {isComplete ? 'Completed' : submission.status?.replace('_', ' ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
