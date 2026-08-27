import { useState } from 'react';
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
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';
import { getModuleLabel, getWeekCode, getPrimaryStatus } from '../../utils/mbwDisplay';
import { DEFAULT_PROGRAM_UI } from '../../data/programUiAdapters';
import TaskTemplateDownloads from '../submissions/TaskTemplateDownloads';
import LearnerReviewFeedback from '../submissions/LearnerReviewFeedback';
import LearnerSubmissionPreview from '../submissions/LearnerSubmissionPreview';
import { useLessonAsset } from '../../hooks/useLessonAsset';

function getSectionTitle(phase, program) {
  return program.sections.find((s) => s.id === phase)?.title ?? program.meta.title;
}

function SubmissionBody({
  task,
  submission,
  canSubmit,
  userId,
  watched,
  showSubmittedPreview,
  onSubmit,
  onSaveTemplate,
  onAddRecurringPost,
}) {
  if (showSubmittedPreview) {
    return (
      <LearnerSubmissionPreview
        submission={submission}
        task={task}
        userId={userId}
        program="100bm"
      />
    );
  }

  return (
    <>
      {!watched && task.requiresWatch && task.videoUrl && (
        <p className="mbw-task__hint">Watch at least 90% of the video to unlock the form below.</p>
      )}
      {task.type === TASK_TYPES.WATCH_ONLY && <WatchOnly task={task} submission={submission} />}
      {task.type === TASK_TYPES.TEXT && (
        <BM100TextSubmission
          key={task.id}
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          readOnly={!canSubmit && Boolean(submission?.textValue)}
          onSubmit={onSubmit}
        />
      )}
      {task.type === TASK_TYPES.LINK && (
        <LinkSubmission
          key={task.id}
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />
      )}
      {task.type === TASK_TYPES.EDITABLE_TEMPLATE && (
        <EditableTemplate
          key={task.id}
          task={task}
          submission={submission}
          canSubmit={canSubmit || !!submission?.templateData}
          onSave={onSaveTemplate}
        />
      )}
      {task.type === TASK_TYPES.FILE_UPLOAD && (
        <FileUpload
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          userId={userId}
          onSubmit={onSubmit}
          program="100bm"
        />
      )}
      {task.type === TASK_TYPES.VIDEO_RECORD && (
        <VideoRecordOrUpload
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          userId={userId}
          onSubmit={onSubmit}
          program="100bm"
        />
      )}
      {task.type === TASK_TYPES.RECURRING_POST && (
        <RecurringPost
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          onAddPost={onAddRecurringPost}
        />
      )}
      {task.type === TASK_TYPES.CHECKLIST && (
        <ChecklistSubmission
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}

function MaterialsSection({ resourceLinks, showExtraTemplates, task }) {
  if (resourceLinks.length === 0 && !showExtraTemplates) return null;
  return (
    <section className="bm100-task-materials" aria-label="Session materials">
      <h3 className="bm100-task-materials__title">Session materials</h3>
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
  );
}

/**
 * @param {'default'|'lesson'} [variant]
 * lesson = TAP Academy–inspired: video → title/meta → Overview / Your work / Course content tabs
 */
export default function BM100TaskContent({
  program = DEFAULT_PROGRAM_UI,
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
  variant = 'default',
  courseContent = null,
}) {
  const { getTaskDurationHint } = program.utils;
  const { task, submission, status, watched, canSubmit, isComplete, prevTaskId, phaseLocked } =
    taskState;
  const lessonAsset = useLessonAsset(taskState?.task?.id);
  const isLesson = variant === 'lesson';
  const [tab, setTab] = useState('overview');
  const hasCourseTab = Boolean(courseContent);

  const locked = status === SUBMISSION_STATUS.LOCKED;
  const showVideo = Boolean(task.videoUrl);
  const resourceLinks = Array.isArray(task.resourceLinks)
    ? task.resourceLinks.filter((r) => r?.url)
    : [];
  const showExtraTemplates =
    task.type !== TASK_TYPES.FILE_UPLOAD && program.getTaskTemplates(task.id, task).length > 0;
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

  const videoBlock =
    !locked && showVideo ? (
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
    ) : null;

  const submissionProps = {
    task,
    submission,
    canSubmit,
    userId,
    watched,
    showSubmittedPreview,
    onSubmit: handleSubmit,
    onSaveTemplate: handleSaveTemplate,
    onAddRecurringPost: handleRecurring,
  };

  const lockedAlert = (
    <div className="alert alert-warning mbw-task__locked">
      {phaseLocked ? (
        <>
          <p>
            This section needs full program payment. Registration access covers Onboarding and Phase
            1 only.
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
  );

  if (isLesson) {
    return (
      <div className="mbw-task mbw-task--lesson">
        {showInlineSuccess && successBanner && (
          <div className="alert alert-success mbw-task__success">{successBanner}</div>
        )}
        {locked && lockedAlert}
        {videoBlock}

        <header className="mbw-task__header mbw-task__header--lesson">
          <h1>{task.title}</h1>
          <div className="mbw-task__meta">
            <span className="mbw-task__tag">{getSectionTitle(task.phase, program)}</span>
            <span className="mbw-task__tag mbw-task__tag--muted">{getModuleLabel(task)}</span>
            {getWeekCode(task) && (
              <span className="mbw-task__tag mbw-task__tag--muted">{getWeekCode(task)}</span>
            )}
            <span className="mbw-task__tag mbw-task__tag--muted">{getTaskDurationHint(task)}</span>
            <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>
              {primary.label}
            </span>
          </div>
        </header>

        {!locked && (
          <>
            <div className="mbw-task__tabs" role="tablist" aria-label="Lesson sections">
              <button
                type="button"
                role="tab"
                id={`${program.key}-tab-overview`}
                aria-selected={tab === 'overview'}
                aria-controls={`${program.key}-panel-overview`}
                className={`mbw-task__tab${tab === 'overview' ? ' is-active' : ''}`}
                onClick={() => setTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                role="tab"
                id={`${program.key}-tab-work`}
                aria-selected={tab === 'work'}
                aria-controls={`${program.key}-panel-work`}
                className={`mbw-task__tab${tab === 'work' ? ' is-active' : ''}`}
                onClick={() => setTab('work')}
              >
                Your work
              </button>
              {hasCourseTab && (
                <button
                  type="button"
                  role="tab"
                  id={`${program.key}-tab-course`}
                  aria-selected={tab === 'course'}
                  aria-controls={`${program.key}-panel-course`}
                  className={`mbw-task__tab mbw-task__tab--course${tab === 'course' ? ' is-active' : ''}`}
                  onClick={() => setTab('course')}
                >
                  Course content
                </button>
              )}
            </div>

            {tab === 'overview' && (
              <section
                className="mbw-task__panel"
                role="tabpanel"
                id={`${program.key}-panel-overview`}
                aria-labelledby={`${program.key}-tab-overview`}
              >
                <h2 className="mbw-task__panel-title">About this task</h2>
                {task.description ? (
                  <p className="mbw-task__desc">{task.description}</p>
                ) : (
                  <p className="mbw-task__desc muted">
                    Watch the lesson, then open Your work to complete the submission.
                  </p>
                )}
                <MaterialsSection
                  resourceLinks={resourceLinks}
                  showExtraTemplates={showExtraTemplates}
                  task={task}
                />
              </section>
            )}

            {tab === 'work' && (
              <section
                className="mbw-task__panel mbw-task__submission"
                role="tabpanel"
                id={`${program.key}-panel-work`}
                aria-labelledby={`${program.key}-tab-work`}
              >
                <h2 className="mbw-task__panel-title">Your submission</h2>
                <SubmissionBody {...submissionProps} />
                <LearnerReviewFeedback submission={submission} />
              </section>
            )}

            {hasCourseTab && tab === 'course' && (
              <section
                className="mbw-task__panel mbw-task__panel--course"
                role="tabpanel"
                id={`${program.key}-panel-course`}
                aria-labelledby={`${program.key}-tab-course`}
              >
                {courseContent}
              </section>
            )}
          </>
        )}
      </div>
    );
  }

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
            <p className="mbw-task__eyebrow">Iron Lady · {program.meta.shortName ?? program.meta.title} · {getSectionTitle(task.phase, program)}</p>
            <h1>{task.title}</h1>
            <div className="mbw-task__meta">
              <span className="mbw-task__module-label">{getModuleLabel(task)}</span>
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

      {locked && lockedAlert}
      {videoBlock}

      {!locked && (
        <MaterialsSection
          resourceLinks={resourceLinks}
          showExtraTemplates={showExtraTemplates}
          task={task}
        />
      )}

      {!locked && (
        <section className="mbw-task__submission">
          <h2>Your submission</h2>
          <SubmissionBody {...submissionProps} />
          <LearnerReviewFeedback submission={submission} />
        </section>
      )}
    </div>
  );
}
