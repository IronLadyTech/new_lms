import { ChevronRight } from 'lucide-react';
import WatchGatedVideo from './WatchGatedVideo';
import TextSubmission from './submissions/TextSubmission';
import LinkSubmission from './submissions/LinkSubmission';
import EditableTemplate from './submissions/EditableTemplate';
import FileUpload from './submissions/FileUpload';
import VideoRecordOrUpload from './submissions/VideoRecordOrUpload';
import WatchOnly from './submissions/WatchOnly';
import RecurringPost from './submissions/RecurringPost';
import ChecklistSubmission from './submissions/ChecklistSubmission';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';
import { getModuleLabel, getWeekCode, getPrimaryStatus } from '../../utils/mbwDisplay';
import { getTaskDurationHint } from '../../utils/mbwProgramUtils';
import { MBW_PROGRAM_SECTIONS } from '../../data/mbwProgramStructure';

function getSectionTitle(phase) {
  return MBW_PROGRAM_SECTIONS.find((s) => s.id === phase)?.title ?? 'MBW';
}

export default function TaskContent({
  taskState,
  userId,
  onWatchProgress,
  onWatchComplete,
  onSubmit,
  onSaveTemplate,
  onAddRecurringPost,
  onActionComplete,
  onGoToPrevious,
  threshold,
  successBanner,
  focusMode = false,
  showInlineSuccess = true,
}) {
  const { task, submission, status, watched, canSubmit, isComplete, prevTaskId } = taskState;
  const locked = status === SUBMISSION_STATUS.LOCKED;
  const showVideo = task.requiresWatch || task.type === TASK_TYPES.WATCH_ONLY;
  const primary = getPrimaryStatus(status, isComplete, task.reviewRequired);

  const handleSubmit = async (fields) => {
    const result = await onSubmit(fields);
    if (result) onActionComplete?.(result);
  };

  const handleSaveTemplate = async (data) => {
    const result = await onSaveTemplate(task.id, data);
    if (result) onActionComplete?.(result);
  };

  const handleRecurring = async (link) => {
    const result = await onAddRecurringPost(link);
    if (result) onActionComplete?.(result);
  };

  const handleWatchComplete = async () => {
    const result = await onWatchComplete();
    if (result) onActionComplete?.(result);
  };

  return (
    <div className={`mbw-task${focusMode ? ' mbw-task--focus' : ''}`}>
      <header className="mbw-task__header">
        {focusMode ? (
          <div className="mbw-task__meta mbw-task__meta--focus">
            <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>{primary.label}</span>
          </div>
        ) : (
          <>
            <p className="mbw-task__eyebrow">Iron Lady · MBW · {getSectionTitle(task.phase)}</p>
            <h1>{task.title}</h1>
            <div className="mbw-task__meta">
              <span className="mbw-task__module-label">{getModuleLabel(task)}</span>
              {getWeekCode(task) && (
                <span className="mbw-task__week-code">{getWeekCode(task)}</span>
              )}
              <span className="mbw-task__duration">{getTaskDurationHint(task)}</span>
              <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>{primary.label}</span>
            </div>
          </>
        )}
        {task.description && <p className="mbw-task__desc">{task.description}</p>}
      </header>

      {showInlineSuccess && successBanner && (
        <div className="alert alert-success mbw-task__success">{successBanner}</div>
      )}

      {locked && (
        <div className="alert alert-warning mbw-task__locked">
          <p>Complete the previous task to unlock this one.</p>
          {prevTaskId && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onGoToPrevious?.(prevTaskId)}>
              Go to previous task <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {!locked && showVideo && (
        <WatchGatedVideo
          taskId={task.id}
          videoUrl={task.videoUrl}
          title={task.title}
          watchPercent={taskState.watchPercent}
          threshold={threshold}
          onProgress={(pct) => onWatchProgress(task.id, pct)}
          onComplete={handleWatchComplete}
        />
      )}

      {!locked && (
        <section className="mbw-task__submission">
          <h2>Your submission</h2>
          {!watched && task.requiresWatch && task.videoUrl && (
            <p className="mbw-task__hint">Watch at least 90% of the video to unlock the form below.</p>
          )}

          {task.type === TASK_TYPES.WATCH_ONLY && (
            <WatchOnly task={task} submission={submission} />
          )}
          {task.type === TASK_TYPES.TEXT && (
            <TextSubmission
              key={task.id}
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              onSubmit={handleSubmit}
            />
          )}
          {task.type === TASK_TYPES.LINK && (
            <LinkSubmission
              key={task.id}
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              onSubmit={handleSubmit}
            />
          )}
          {task.type === TASK_TYPES.EDITABLE_TEMPLATE && (
            <EditableTemplate
              key={task.id}
              task={task}
              submission={submission}
              canSubmit={canSubmit || !!submission?.templateData}
              onSave={handleSaveTemplate}
            />
          )}
          {task.type === TASK_TYPES.FILE_UPLOAD && (
            <FileUpload
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              userId={userId}
              onSubmit={handleSubmit}
            />
          )}
          {task.type === TASK_TYPES.VIDEO_RECORD && (
            <VideoRecordOrUpload
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              userId={userId}
              onSubmit={handleSubmit}
            />
          )}
          {task.type === TASK_TYPES.RECURRING_POST && (
            <RecurringPost
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              onAddPost={handleRecurring}
            />
          )}
          {task.type === TASK_TYPES.CHECKLIST && (
            <ChecklistSubmission
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              onSubmit={handleSubmit}
            />
          )}

          {submission?.feedback && (
            <div className="alert alert-warning">
              <strong>Instructor feedback:</strong> {submission.feedback}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
