import { ChevronRight } from 'lucide-react';
import WatchGatedVideo from './WatchGatedVideo';
import TextSubmission from './submissions/TextSubmission';
import LinkSubmission from './submissions/LinkSubmission';
import EditableTemplate from './submissions/EditableTemplate';
import FileUpload from '../submissions/FileUpload';
import VideoRecordOrUpload from '../submissions/VideoRecordOrUpload';
import WatchOnly from './submissions/WatchOnly';
import RecurringPost from './submissions/RecurringPost';
import ChecklistSubmission from './submissions/ChecklistSubmission';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';
import { getWeekCode, getPrimaryStatus } from '../../utils/mbwDisplay';
import { getTaskDurationHint } from '../../utils/mbwProgramUtils';
import LearnerReviewFeedback from '../submissions/LearnerReviewFeedback';
import LearnerSubmissionPreview from '../submissions/LearnerSubmissionPreview';
import { useLessonAsset } from '../../hooks/useLessonAsset';

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
  // Lesson media is fetched rather than bundled: shipping URLs to every
  // browser meant an unpaid learner could read them out of the page.
  const lessonAsset = useLessonAsset(taskState?.task?.id);

  const locked = status === SUBMISSION_STATUS.LOCKED;
  const showVideo = task.requiresWatch || task.type === TASK_TYPES.WATCH_ONLY;
  const primary = getPrimaryStatus(status, isComplete);
  const showSubmittedPreview =
    Boolean(submission) &&
    isComplete &&
    !canSubmit &&
    task.type !== TASK_TYPES.EDITABLE_TEMPLATE &&
    task.type !== TASK_TYPES.WATCH_ONLY;

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
            <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>
              {primary.label}
            </span>
          </div>
        ) : (
          <>
            {/*
              No breadcrumb and no module label here: the programme hero directly
              above already carries a fuller trail (Programs / MBW / section /
              module) and the module label repeated the heading word for word.
              This heading is the lesson name, once.
            */}
            <h1>{task.title}</h1>
            <div className="mbw-task__meta">
              {getWeekCode(task) && (
                <span className="mbw-task__week-code">{getWeekCode(task)}</span>
              )}
              <span className="mbw-task__duration">{getTaskDurationHint(task)}</span>
              <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>
                {primary.label}
              </span>
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
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onGoToPrevious?.(prevTaskId)}
            >
              Go to previous task <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {!locked && showVideo && (
        <WatchGatedVideo
          taskId={task.id}
          videoUrl={lessonAsset.url || ''}
          title={task.title}
          watchPercent={taskState.watchPercent}
          threshold={threshold}
          captionsUrl={task.captionsUrl || task.captionUrl || ''}
          onProgress={(pct) => onWatchProgress(task.id, pct)}
          onComplete={handleWatchComplete}
        />
      )}

      {!locked && (
        <section className="mbw-task__submission">
          <h2>Your submission</h2>
          {!watched && task.requiresWatch && task.videoUrl && (
            <p className="mbw-task__hint">
              Watch at least 90% of the video to unlock the form below.
            </p>
          )}

          {showSubmittedPreview ? (
            <LearnerSubmissionPreview
              submission={submission}
              task={task}
              userId={userId}
              program="mbw"
            />
          ) : (
            <>
              {task.type === TASK_TYPES.WATCH_ONLY && (
                <WatchOnly task={task} submission={submission} />
              )}
              {task.type === TASK_TYPES.TEXT && (
                <TextSubmission
                  key={task.id}
                  task={task}
                  submission={submission}
                  canSubmit={canSubmit}
                  readOnly={!canSubmit && Boolean(submission?.textValue)}
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
            </>
          )}

          <LearnerReviewFeedback submission={submission} />
        </section>
      )}
    </div>
  );
}
