import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Clock,
  CloudCheck,
  ExternalLink,
  FileText,
  Lock,
  PenLine,
  PlayCircle,
} from 'lucide-react';
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
import LessonDocument from '../lessons/LessonDocument';
import LessonPlayerBar from '../lessons/LessonPlayerBar';
import { taskActionLabel } from '../lessons/lessonContext';
import { taskTypeIcon } from '../mbw/program/taskTypeIcons';
import { getTaskKindLabel } from '../../utils/taskKindLabel';
import TemplateReadOnly from '../mbw/TemplateReadOnly';
import { getFormTemplate } from '../../data/formTemplates/registry';
import { actionLinks } from '../../utils/lessonResources';
import {
  templateDraftKey,
  clearTemplateDraft,
  draftDayLabel,
  draftSavedLabel,
  readTemplateDraft,
} from '../../utils/templateDrafts';
import useMediaQuery from '../../hooks/useMediaQuery';

/* Answers the browser can keep a draft of: text a learner types, never a file. */
const DRAFTABLE = new Set([TASK_TYPES.EDITABLE_TEMPLATE, TASK_TYPES.TEXT, TASK_TYPES.LINK]);

/* In with CX, approved, or sent back: the work has been handed in at least once. */
const HANDED_IN = new Set([
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.UNDER_REVIEW,
  SUBMISSION_STATUS.COMPLETED,
  SUBMISSION_STATUS.NEEDS_IMPROVEMENT,
  SUBMISSION_STATUS.REJECTED,
]);

const SUBMITTED_AT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatWhen(raw) {
  const date = typeof raw?.toDate === 'function' ? raw.toDate() : raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? SUBMITTED_AT.format(date) : '';
}

/** "Submitted 14 Sep 2026, 7:52 pm", "Resubmitted …", or '' before a hand-in. */
function submittedLabel(submission, versionCount = 0) {
  if (!submission || !HANDED_IN.has(submission.status)) return '';
  const verb = versionCount > 1 ? 'Resubmitted' : 'Submitted';
  const when = formatWhen(submission.submittedAt || submission.updatedAt);
  return when ? `${verb} ${when}` : verb;
}

/*
 * "Draft saved on this device · just now". Re-reads the clock every 30 seconds
 * so "just now" turns into minutes instead of going stale on screen.
 */
function DraftSavedNote({ savedAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [savedAt]);
  return (
    <span className="lesson-work__draft">
      <CloudCheck size={16} aria-hidden="true" />
      {`Draft saved on this device · ${draftSavedLabel(savedAt, now)}`}
    </span>
  );
}

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
  guidance = false,
  lockSubmittedTemplates = false,
  templateSubmitLabel = '',
  templateCompareTo = null,
  templateDraftKey: draftKey = '',
  templateOnDraftChange,
  templateOnDiscard,
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
          submitLabel={templateSubmitLabel}
          draftKey={draftKey}
          onDraftChange={templateOnDraftChange}
        />
      )}
      {task.type === TASK_TYPES.LINK && (
        <LinkSubmission
          key={task.id}
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
          submitLabel={templateSubmitLabel}
          draftKey={draftKey}
          onDraftChange={templateOnDraftChange}
        />
      )}
      {task.type === TASK_TYPES.EDITABLE_TEMPLATE &&
        /*
         * LEP shows a handed-in worksheet as what was sent, until the learner
         * chooses to edit it: the same worksheet, locked, so the task keeps its
         * shape. Elsewhere a worksheet stays open as it always has.
         */
        (lockSubmittedTemplates && submission?.templateData && !canSubmit ? (
          getFormTemplate(task.templateId || submission.templateData.templateId)?.type ===
          'fields' ? (
            <EditableTemplate
              key={`${task.id}-locked`}
              task={task}
              submission={submission}
              canSubmit={false}
              onSave={onSaveTemplate}
              locked
            />
          ) : (
            <TemplateReadOnly templateData={submission.templateData} task={task} />
          )
        ) : (
          <EditableTemplate
            key={task.id}
            task={task}
            submission={submission}
            canSubmit={lockSubmittedTemplates ? canSubmit : canSubmit || !!submission?.templateData}
            onSave={onSaveTemplate}
            guidance={guidance}
            submitLabel={templateSubmitLabel}
            compareTo={templateCompareTo}
            draftKey={draftKey}
            onDraftChange={templateOnDraftChange}
            onDiscard={templateOnDiscard}
          />
        ))}
      {task.type === TASK_TYPES.FILE_UPLOAD && (
        <FileUpload
          task={task}
          submission={submission}
          canSubmit={canSubmit}
          userId={userId}
          onSubmit={onSubmit}
          program="100bm"
          submitLabel={templateSubmitLabel}
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
      {showExtraTemplates && <TaskTemplateDownloads taskId={task.id} task={task} program="100bm" />}
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
  playerControls = null,
  assignmentGuidance = false,
  lessonContext = null,
}) {
  const { getTaskDurationHint } = program.utils;
  /*
   * Tabs are a narrow-screen device. With room to spare there is no reason to
   * make someone choose between the task and their work — both are shown, and
   * the outline lives in the side rail rather than a third tab.
   */
  /* LEP keeps one stacked layout down to phone width, where the tabs return. */
  const stacked = useMediaQuery(lessonContext ? '(min-width: 561px)' : '(min-width: 1024px)');
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
  const [tab, setTab] = useState('overview');

  /*
   * Editing a handed-in submission (LEP). Local to the lesson: what the learner
   * sent stays their submission until they resubmit. Closes when the lesson
   * changes, when a new version lands, or when review starts; reopens by itself
   * when a draft was left on this device, so unfinished changes are not lost.
   */
  const [editing, setEditing] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const versions = Array.isArray(taskState.versions) ? taskState.versions : [];
  const versionCount = versions.length;
  const latestVersion = versions[versionCount - 1] || null;
  const canEditNow = Boolean(lessonContext && taskState.canEdit);
  useEffect(() => {
    const draftLeft = Boolean(readTemplateDraft(templateDraftKey(userId, taskState?.task?.id)));
    setEditing(canEditNow && draftLeft);
  }, [taskState?.task?.id, versionCount, canEditNow, userId]);
  const lessonCanSubmit = lessonContext ? canSubmit || (editing && canEditNow) : canSubmit;
  const hasCourseTab = Boolean(courseContent);

  const locked = status === SUBMISSION_STATUS.LOCKED;
  const playableVideoUrl = String(lessonAsset.url || '').trim();
  const showVideo = Boolean(playableVideoUrl);
  /*
   * In LEP the handouts live in the course content list beside the lesson, as a
   * player keeps its resources; what stays here is the link the task asks the
   * learner to go and use. Every other programme lists them all, as before.
   */
  const resourceLinks = lessonContext
    ? actionLinks(task)
    : Array.isArray(task.resourceLinks)
      ? task.resourceLinks.filter((r) => r?.url)
      : [];
  const showExtraTemplates =
    task.type !== TASK_TYPES.FILE_UPLOAD && program.getTaskTemplates(task.id, task).length > 0;
  const primary = getPrimaryStatus(status, isComplete);
  const showSubmittedPreview =
    Boolean(submission) &&
    isComplete &&
    !lessonCanSubmit &&
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
        videoUrl={playableVideoUrl}
        title={task.title}
        watchPercent={taskState.watchPercent}
        threshold={threshold}
        captionsUrl={task.captionsUrl || task.captionUrl || ''}
        onProgress={(pct) => onWatchProgress(task.id, pct)}
        onComplete={handleWatchComplete}
      />
    ) : null;

  /*
   * Reading material shown where a video would play. Only a task that names a
   * `readingDocument` gets one; every other lesson renders as it did.
   */
  const readingDocument = task.readingDocument?.url ? task.readingDocument : null;
  const documentBlock =
    !locked && readingDocument ? (
      <LessonDocument document={readingDocument} title={task.title} />
    ) : null;

  /*
   * The bar under the player: Fullscreen and Expand, as on Udemy. Only a page
   * that passes `playerControls` gets it (LEP), so 100BM's lessons are as they
   * were. A video brings its own fullscreen control, so the bar offers
   * fullscreen only for a document, and sits inside the document's stage so the
   * exit button is still on screen once the stage fills it.
   *
   * Form-only lessons (no video, no PDF) do not get an empty bar — only the
   * expand control when the rail is already hidden, so the learner can bring
   * course content back after leaving a media lesson.
   */
  /*
   * "Go to assignment" from the player, as the lesson design has it. Offered only
   * on an assignment, since a checklist or a watched video has no work to jump to.
   */
  const jumpToWork =
    lessonContext && !locked && getTaskKindLabel(task.type) === 'Assignment'
      ? () => {
          const work = document.querySelector('[data-lesson-work]');
          if (!work) return;
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          work.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          work.focus?.({ preventScroll: true });
        }
      : undefined;

  const stageRef = useRef(null);
  const hasPlayerMedia = Boolean(documentBlock || videoBlock);
  /*
   * The bar belongs to the player: it carries Fullscreen, Expand and the jump to
   * the assignment. On a lesson with neither a video nor a reading it was a row
   * of controls with nothing above them, so it appears only where there is media.
   */
  const playerBar =
    playerControls && hasPlayerMedia ? (
      <LessonPlayerBar
        fullscreenTarget={documentBlock ? stageRef : null}
        expanded={playerControls.expanded}
        onToggleExpand={playerControls.onToggleExpand}
        label={documentBlock ? readingDocument.label : ''}
        openUrl={documentBlock ? readingDocument.url : ''}
        onJumpToWork={jumpToWork}
      />
    ) : null;

  const draftKeyForTask = templateDraftKey(userId, task.id);
  const discardEdit = () => {
    clearTemplateDraft(draftKeyForTask);
    setDraftSavedAt(null);
    setEditing(false);
  };

  const submissionProps = {
    task,
    submission,
    canSubmit: lessonCanSubmit,
    userId,
    watched,
    showSubmittedPreview,
    onSubmit: handleSubmit,
    onSaveTemplate: handleSaveTemplate,
    onAddRecurringPost: handleRecurring,
    // LEP only: what a worksheet still needs, written beside Submit.
    guidance: assignmentGuidance,
    lockSubmittedTemplates: Boolean(lessonContext),
    templateSubmitLabel: editing ? `Resubmit as v${versionCount + 1}` : '',
    templateCompareTo: editing ? latestVersion?.data?.templateData?.fields || null : null,
    templateDraftKey: lessonContext && lessonCanSubmit ? draftKeyForTask : '',
    templateOnDraftChange: lessonContext ? setDraftSavedAt : undefined,
    templateOnDiscard: editing ? discardEdit : undefined,
  };

  /*
   * This component is shared: LEP renders it too. It used to name 100BM's own
   * phases — "Registration access covers Onboarding and Phase 1" — on every LEP
   * lesson, and it said that for any locked phase, including one a fully paid
   * learner had simply not reached yet. Both wrongs are the same wrong: the
   * message asserted a reason it had not been told.
   */
  /*
   * A LEP lesson's place and kind, shown only when the page passes
   * `lessonContext`: where it sits (programme, day, "Lesson 3 of 6"), what it
   * asks of the learner, and when the work went in. 100BM passes nothing.
   */
  const TypeIcon = taskTypeIcon(program.utils.getTaskTypeIcon?.(task.type));
  const actionLabel = taskActionLabel(task.type);
  const workSubmittedLabel = lessonContext ? submittedLabel(submission, versionCount) : '';
  const lessonCrumb = lessonContext ? (
    <nav className="lesson-crumb" aria-label="Lesson location">
      <button type="button" className="lesson-crumb__link" onClick={lessonContext.onBack}>
        {lessonContext.programTitle}
      </button>
      {lessonContext.sectionLabel && (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="lesson-crumb__here">{lessonContext.sectionLabel}</span>
        </>
      )}
      {lessonContext.position && (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <span>{`Lesson ${lessonContext.position.index} of ${lessonContext.position.total}`}</span>
        </>
      )}
    </nav>
  ) : null;

  const lockedByPayment = phaseLocked && lockedBy === 'payment';

  const lockedAlert = (
    <div className="alert alert-warning mbw-task__locked">
      {lockedByPayment ? (
        <>
          <p>This section needs full program payment.</p>
          <Link to="/app/support" className="btn btn-outline btn-sm">
            Payment support
          </Link>
        </>
      ) : phaseLocked ? (
        <>
          <p>Finish the phase before this one and it opens on its own.</p>
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

  /*
   * A lesson reads in one order: where you are, what the lesson is, the video
   * or reading, the task, then your work. The player used to come before the
   * title, which opened a submitted assignment on its own history. LEP takes
   * the new order; 100BM keeps the player first, as it always has.
   */
  const lessonHeader = (
    <header className="mbw-task__header mbw-task__header--lesson">
      <h1>{task.title}</h1>
      {/*
       * Phase / module / week / duration tags duplicated the breadcrumb and
       * the title (e.g. "Phase 1 — Foundation Module 3 — Session 1… Wk1
       * Template" as one run-on line). Keep only status under the task name.
       */}
      <div
        className={`mbw-task__meta mbw-task__meta--lesson${lessonContext ? ' lesson-meta' : ''}`}
      >
        {lessonContext && showVideo && (
          <span className="lesson-meta__item">
            <PlayCircle size={16} aria-hidden="true" />
            Video
          </span>
        )}
        {lessonContext && readingDocument && (
          <span className="lesson-meta__item">
            <FileText size={16} aria-hidden="true" />
            Reading
          </span>
        )}
        {lessonContext && actionLabel && (
          <span className="lesson-meta__item">
            <TypeIcon size={16} aria-hidden="true" />
            {`${getTaskKindLabel(task.type)} · ${actionLabel}`}
          </span>
        )}
        <span className={`mbw-status-pill mbw-status-pill--${primary.tone}`}>
          {primary.label}
        </span>
      </div>
    </header>
  );

  const lessonMedia = (
    <>
      {videoBlock}
      {documentBlock ? (
        <div className="lesson-document-stage" ref={stageRef}>
          {documentBlock}
          {playerBar}
        </div>
      ) : (
        playerBar
      )}
    </>
  );

  if (isLesson) {
    return (
      <div className={`mbw-task mbw-task--lesson${lessonContext ? ' mbw-task--lep' : ''}`}>
        {lessonCrumb}
        {showInlineSuccess && successBanner && (
          <div className="alert alert-success mbw-task__success">{successBanner}</div>
        )}
        {locked && lockedAlert}
        {lessonContext ? (
          <>
            {lessonHeader}
            {lessonMedia}
          </>
        ) : (
          <>
            {lessonMedia}
            {lessonHeader}
          </>
        )}

        {!locked && !showVideo && task.requiresWatch && !watched && (
          <p className="mbw-task__no-video">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleWatchComplete}>
              Continue without video
            </button>
          </p>
        )}

        {!locked && (
          <>
            {!stacked && (
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
            )}

            {(stacked || tab === 'overview') && (
              <section
                className="mbw-task__panel"
                {...(stacked
                  ? {}
                  : {
                      role: 'tabpanel',
                      id: `${program.key}-panel-overview`,
                      'aria-labelledby': `${program.key}-tab-overview`,
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
                <MaterialsSection
                  resourceLinks={resourceLinks}
                  showExtraTemplates={showExtraTemplates}
                  task={task}
                />
              </section>
            )}

            {(stacked || tab === 'work') && (
              <section
                className={`mbw-task__panel mbw-task__submission${lessonContext ? ' lesson-work' : ''}`}
                data-lesson-work={lessonContext ? '' : undefined}
                tabIndex={lessonContext ? -1 : undefined}
                {...(stacked
                  ? {}
                  : {
                      role: 'tabpanel',
                      id: `${program.key}-panel-work`,
                      'aria-labelledby': `${program.key}-tab-work`,
                    })}
              >
                {lessonContext ? (
                  <>
                    <div className="lesson-work__head">
                      <h2 className="mbw-task__panel-title">Your submission</h2>
                      {versionCount > 0 && (
                        <span className="lesson-work__version">
                          {editing ? `v${versionCount} → v${versionCount + 1}` : `v${versionCount}`}
                        </span>
                      )}
                      {workSubmittedLabel && !editing && (
                        <span className="lesson-work__when">{workSubmittedLabel}</span>
                      )}
                      {lessonCanSubmit && draftSavedAt && <DraftSavedNote savedAt={draftSavedAt} />}
                    </div>
                    <div className="lesson-work__body">
                      {editing && (
                        <div className="lesson-work__banner" role="status">
                          <PenLine size={18} aria-hidden="true" />
                          <p>
                            <strong>You’re editing your submission.</strong>
                            {DRAFTABLE.has(task.type)
                              ? `v${versionCount} stays as your submitted version until you resubmit. Changes save as a draft on this device.`
                              : `v${versionCount} stays as your submitted version until you resubmit.`}
                          </p>
                          {/* A worksheet keeps Discard beside its own Submit; every
                              other kind of hand-in needs the way out here. */}
                          {task.type !== TASK_TYPES.EDITABLE_TEMPLATE && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={discardEdit}
                            >
                              Discard changes
                            </button>
                          )}
                        </div>
                      )}

                      <SubmissionBody {...submissionProps} />

                      {!editing && canEditNow && (
                        <div className="lesson-work__editbar">
                          <p className="lesson-work__note">
                            <Clock size={16} aria-hidden="true" />
                            You can edit and resubmit until your facilitator starts reviewing.
                          </p>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setEditing(true)}
                          >
                            <PenLine size={16} aria-hidden="true" />
                            Edit submission
                          </button>
                        </div>
                      )}

                      {status === SUBMISSION_STATUS.UNDER_REVIEW && (
                        <p className="lesson-work__note lesson-work__note--review">
                          <Lock size={16} aria-hidden="true" />
                          Your facilitator is reviewing this, so it can’t be edited now.
                        </p>
                      )}

                      <LearnerReviewFeedback submission={submission} variant="facilitator" />

                      {versionCount > 0 && (
                        <section className="lesson-history" aria-labelledby="lesson-history-title">
                          <h3 id="lesson-history-title" className="lesson-history__title">
                            Version history
                          </h3>
                          <ol className="lesson-history__list">
                            {versions.map((v) => (
                              <li key={v.version} className="lesson-history__item">
                                <span className="lesson-history__dot" aria-hidden="true" />
                                <span className="lesson-history__what">
                                  <strong>
                                    {v.version === 1 ? 'v1 submitted' : `v${v.version} resubmitted`}
                                  </strong>
                                </span>
                                <span className="lesson-history__when">
                                  {formatWhen(v.submittedAt)}
                                </span>
                              </li>
                            ))}
                            {editing && (
                              <li className="lesson-history__item is-draft">
                                <span className="lesson-history__dot" aria-hidden="true" />
                                <span className="lesson-history__what">
                                  {/* Only a worksheet keeps a draft; on an upload
                                      the edit lives until it is sent. */}
                                  <strong>
                                    {draftSavedAt
                                      ? `Draft v${versionCount + 1} started`
                                      : `Editing v${versionCount + 1}`}
                                  </strong>
                                  <small>Not submitted yet</small>
                                </span>
                                <span className="lesson-history__when">
                                  {draftSavedAt ? draftDayLabel(draftSavedAt) : 'Now'}
                                </span>
                              </li>
                            )}
                          </ol>
                        </section>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mbw-task__panel-title">Your submission</h2>
                    <SubmissionBody {...submissionProps} />
                    <LearnerReviewFeedback submission={submission} />
                  </>
                )}
              </section>
            )}

            {!stacked && hasCourseTab && tab === 'course' && (
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
            <p className="mbw-task__eyebrow">
              Iron Lady · {program.meta.shortName ?? program.meta.title} ·{' '}
              {getSectionTitle(task.phase, program)}
            </p>
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
      {documentBlock}

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
