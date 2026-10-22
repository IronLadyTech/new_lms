import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import useMediaQuery from '../../hooks/useMediaQuery';

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
        program="mbw"
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
        <TextSubmission
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
        />
      )}
      {task.type === TASK_TYPES.VIDEO_RECORD && (
        <VideoRecordOrUpload
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          userId={userId}
          onSubmit={onSubmit}
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

/**
 * @param {'default'|'lesson'} [variant]
 * lesson = TAP Academy–inspired: video → title/meta → Overview / Your work / Course content tabs
 */
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
  variant = 'default',
  courseContent = null,
}) {
  const {
    task,
    submission,
    status,
    watched,
    canSubmit,
    isComplete,
    prevTaskId,
    phaseLocked,
    lockedBy,
  } = taskState;
  const lessonAsset = useLessonAsset(taskState?.task?.id);
  const isLesson = variant === 'lesson';
  /*
   * Tabs are for narrow screens only. On web, Overview + Your work stack open;
   * Course content lives in the sticky side rail (not a third tab).
   */
  const stacked = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState('overview');
  const hasCourseTab = Boolean(courseContent);

  const locked = status === SUBMISSION_STATUS.LOCKED;
  const lockedByPayment = phaseLocked && lockedBy === 'payment';
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

  const metaPills = (
    <div className="mbw-task__meta">
      {getWeekCode(task) && <span className="mbw-task__tag">{getWeekCode(task)}</span>}
      <span className="mbw-task__tag mbw-task__tag--muted">{getTaskDurationHint(task)}</span>
      <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>{primary.label}</span>
    </div>
  );

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

  if (isLesson) {
    return (
      <div className="mbw-task mbw-task--lesson">
        {showInlineSuccess && successBanner && (
          <div className="alert alert-success mbw-task__success">{successBanner}</div>
        )}

        {locked && (
          <div className="alert alert-warning mbw-task__locked">
            {lockedByPayment ? (
              <>
                <p>This section needs full program payment.</p>
                <Link to="/app/support" className="btn btn-outline btn-sm">
                  Payment support
                </Link>
              </>
            ) : phaseLocked ? (
              <p>Finish the phase before this one and it opens on its own.</p>
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

        {videoBlock}

        <header className="mbw-task__header mbw-task__header--lesson">
          <h1>{task.title}</h1>
          {metaPills}
        </header>

        {!locked && (
          <>
            {!stacked && (
              <div className="mbw-task__tabs" role="tablist" aria-label="Lesson sections">
                <button
                  type="button"
                  role="tab"
                  id="mbw-tab-overview"
                  aria-selected={tab === 'overview'}
                  aria-controls="mbw-panel-overview"
                  className={`mbw-task__tab${tab === 'overview' ? ' is-active' : ''}`}
                  onClick={() => setTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  role="tab"
                  id="mbw-tab-work"
                  aria-selected={tab === 'work'}
                  aria-controls="mbw-panel-work"
                  className={`mbw-task__tab${tab === 'work' ? ' is-active' : ''}`}
                  onClick={() => setTab('work')}
                >
                  Your work
                </button>
                {hasCourseTab && (
                  <button
                    type="button"
                    role="tab"
                    id="mbw-tab-course"
                    aria-selected={tab === 'course'}
                    aria-controls="mbw-panel-course"
                    className={`mbw-task__tab mbw-task__tab--course${tab === 'course' ? ' is-active' : ''}`}
                    onClick={() => setTab('course')}
                  >
                    Course content
                  </button>
                )}
              </div>
            )}

            {(stacked || tab === 'overview') && (
              <section
                className="mbw-task__panel"
                {...(stacked
                  ? {}
                  : {
                      role: 'tabpanel',
                      id: 'mbw-panel-overview',
                      'aria-labelledby': 'mbw-tab-overview',
                    })}
              >
                <h2 className="mbw-task__panel-title">About this task</h2>
                {task.description ? (
                  <p className="mbw-task__desc">{task.description}</p>
                ) : (
                  <p className="mbw-task__desc muted">
                    Watch the lesson, then open Your work to complete the submission.
                  </p>
                )}
              </section>
            )}

            {(stacked || tab === 'work') && (
              <section
                className="mbw-task__panel mbw-task__submission"
                {...(stacked
                  ? {}
                  : {
                      role: 'tabpanel',
                      id: 'mbw-panel-work',
                      'aria-labelledby': 'mbw-tab-work',
                    })}
              >
                <h2 className="mbw-task__panel-title">Your submission</h2>
                <SubmissionBody {...submissionProps} />
                <LearnerReviewFeedback submission={submission} />
              </section>
            )}

            {!stacked && hasCourseTab && tab === 'course' && (
              <section
                className="mbw-task__panel mbw-task__panel--course"
                role="tabpanel"
                id="mbw-panel-course"
                aria-labelledby="mbw-tab-course"
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
          {lockedByPayment ? (
            <>
              <p>This section needs full program payment.</p>
              <Link to="/app/support" className="btn btn-outline btn-sm">
                Payment support
              </Link>
            </>
          ) : phaseLocked ? (
            <p>Finish the phase before this one and it opens on its own.</p>
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

      {videoBlock}

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
