import { ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import WatchGatedVideo from '../mbw/WatchGatedVideo';
import BM100TextSubmission from './submissions/BM100TextSubmission';
import LinkSubmission from '../mbw/submissions/LinkSubmission';
import EditableTemplate from '../mbw/submissions/EditableTemplate';
import WatchOnly from '../mbw/submissions/WatchOnly';
import RecurringPost from '../mbw/submissions/RecurringPost';
import ChecklistSubmission from '../mbw/submissions/ChecklistSubmission';
import FileUpload from '../submissions/FileUpload';
import VideoRecordOrUpload from '../submissions/VideoRecordOrUpload';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/bm100Service';
import { getModuleLabel, getWeekCode, getPrimaryStatus } from '../../utils/mbwDisplay';
import { getTaskDurationHint } from '../../utils/bm100ProgramUtils';
import { BM100_PROGRAM_SECTIONS } from '../../data/bm100ProgramStructure';
import { getBm100TaskTemplates } from '../../data/bm100TaskTemplates';
import TaskTemplateDownloads from '../submissions/TaskTemplateDownloads';
import LearnerReviewFeedback from '../submissions/LearnerReviewFeedback';
import LearnerSubmissionPreview from '../submissions/LearnerSubmissionPreview';

function getSectionTitle(phase) {
  return BM100_PROGRAM_SECTIONS.find((s) => s.id === phase)?.title ?? '100BM';
}

export default function BM100TaskContent({
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
  const { task, submission, status, watched, canSubmit, isComplete, prevTaskId, phaseLocked } = taskState;
  const locked = status === SUBMISSION_STATUS.LOCKED;
  const showVideo = Boolean(task.videoUrl);
  const resourceLinks = Array.isArray(task.resourceLinks) ? task.resourceLinks.filter((r) => r?.url) : [];
  const showExtraTemplates =
    task.type !== TASK_TYPES.FILE_UPLOAD && getBm100TaskTemplates(task.id, task).length > 0;
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
            <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>{primary.label}</span>
          </div>
        ) : (
          <>
            <p className="mbw-task__eyebrow">Iron Lady · 100BM · {getSectionTitle(task.phase)}</p>
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
          {phaseLocked ? (
            <>
              <p>
                This section needs full program payment. Registration access covers Onboarding and Phase 1
                only.
              </p>
              <Link to="/app/support" className="btn btn-outline btn-sm">
                Payment support
              </Link>
            </>
          ) : (
            <>
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
            </>
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

      {!locked && (resourceLinks.length > 0 || showExtraTemplates) && (
        <section className="bm100-task-materials" aria-label="Session materials">
          <h2 className="bm100-task-materials__title">Session materials</h2>
          {resourceLinks.length > 0 && (
            <ul className="bm100-task-materials__links">
              {resourceLinks.map((link) => (
                <li key={link.url}>
                  <a
                    className="bm100-task-materials__link"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    <span>{link.label || 'Open resource'}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {showExtraTemplates && (
            <TaskTemplateDownloads taskId={task.id} task={task} program="100bm" />
          )}
        </section>
      )}

      {!locked && (
        <section className="mbw-task__submission">
          <h2>Your submission</h2>
          {!watched && task.requiresWatch && task.videoUrl && (
            <p className="mbw-task__hint">Watch at least 90% of the video to unlock the form below.</p>
          )}

          {showSubmittedPreview ? (
            <LearnerSubmissionPreview
              submission={submission}
              task={task}
              userId={userId}
              program="100bm"
            />
          ) : (
            <>
          {task.type === TASK_TYPES.WATCH_ONLY && (
            <WatchOnly task={task} submission={submission} />
          )}
          {task.type === TASK_TYPES.TEXT && (
            <BM100TextSubmission
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
              program="100bm"
            />
          )}
          {task.type === TASK_TYPES.VIDEO_RECORD && (
            <VideoRecordOrUpload
              task={task}
              submission={submission}
              canSubmit={canSubmit}
              userId={userId}
              onSubmit={handleSubmit}
              program="100bm"
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
