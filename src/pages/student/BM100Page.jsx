import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useBm100TaskEngine from '../../hooks/useBm100TaskEngine';
import useBm100Enrollment from '../../hooks/useBm100Enrollment';
import useBatchRecordings from '../../hooks/useBatchRecordings';
import MBWToast from '../../components/mbw/MBWToast';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import MBWProgramSkeleton from '../../components/mbw/program/MBWProgramSkeleton';
import BM100ProgramHero from '../../components/bm100/program/BM100ProgramHero';
import BM100LessonTopbar from '../../components/bm100/program/BM100LessonTopbar';
import BM100LessonCurriculumDrawer from '../../components/bm100/program/BM100LessonCurriculumDrawer';
import BM100OverviewView from '../../components/bm100/views/BM100OverviewView';
import BM100LessonView from '../../components/bm100/views/BM100LessonView';
import { countSavedSubmissions } from '../../utils/mbwSubmissionUtils';
import {
  computeSectionProgress,
  getCurrentSectionId,
  getTotalMilestones,
  getCompletedMilestones,
  getCohortLabel,
} from '../../utils/bm100ProgramUtils';
import { getModuleLabel } from '../../utils/mbwDisplay';

export default function BM100Page() {
  const { user, profile, isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enrolled } = useBm100Enrollment();
  const { recordings } = useBatchRecordings();

  const [expandedSectionId, setExpandedSectionId] = useState('onboarding');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const lessonIdFromUrl = searchParams.get('lesson');

  const engine = useBm100TaskEngine(user?.uid);
  const {
    taskStates,
    loading,
    error,
    completedCount,
    nextTaskState,
    awaitingFullPayment,
    getNextTaskId,
    getNextSequentialTaskState,
    getPrevTaskId,
    reload,
    setWatchProgressForTask,
    markWatchComplete,
    submitTask,
    saveTemplate,
    addRecurringPost,
    WATCH_THRESHOLD,
    submissions,
  } = engine;

  const sectionProgress = useMemo(() => computeSectionProgress(taskStates, profile), [taskStates, profile]);
  const currentSectionId = useMemo(() => getCurrentSectionId(sectionProgress), [sectionProgress]);
  const totalMilestones = useMemo(() => getTotalMilestones(sectionProgress), [sectionProgress]);
  const completedMilestones = useMemo(() => getCompletedMilestones(sectionProgress), [sectionProgress]);
  const nextTaskId = nextTaskState?.task?.id || null;

  const hasLocalOnly = useMemo(
    () => Object.values(submissions || {}).some((s) => s._local),
    [submissions]
  );

  const activeState = useMemo(
    () => (lessonIdFromUrl ? taskStates.find((t) => t.task.id === lessonIdFromUrl) : null),
    [taskStates, lessonIdFromUrl]
  );

  const lessonMode = Boolean(activeState);
  const activeTaskId = activeState?.task.id || null;
  const nextFromCurrent = activeTaskId ? getNextTaskId(activeTaskId) : null;
  const prevFromCurrent = activeTaskId ? getPrevTaskId(activeTaskId) : null;
  const nextLessonState = useMemo(
    () => (nextFromCurrent ? taskStates.find((t) => t.task.id === nextFromCurrent) : null),
    [nextFromCurrent, taskStates]
  );

  useEffect(() => {
    if (lessonIdFromUrl && taskStates.length && !activeState) {
      setSearchParams({}, { replace: true });
    }
  }, [lessonIdFromUrl, taskStates, activeState, setSearchParams]);

  useEffect(() => {
    if (currentSectionId && !expandedSectionId) {
      setExpandedSectionId(currentSectionId);
    }
  }, [currentSectionId, expandedSectionId]);

  const scrollToLessonPanel = useCallback(() => {
    requestAnimationFrame(() => {
      const panel = document.getElementById('bm100-lesson-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, []);

  useEffect(() => {
    if (!lessonIdFromUrl || !activeState) return undefined;
    const timer = window.setTimeout(() => scrollToLessonPanel(), 50);
    return () => window.clearTimeout(timer);
  }, [lessonIdFromUrl, activeState?.task.id, scrollToLessonPanel]);

  useEffect(() => {
    if (lessonMode && activeState?.task.phase) {
      setExpandedSectionId(activeState.task.phase);
    }
  }, [lessonMode, activeState?.task.phase]);

  const openTask = useCallback(
    (taskId) => {
      setSuccessBanner('');
      setSearchParams({ lesson: taskId }, { replace: true });
      scrollToLessonPanel();
    },
    [setSearchParams, scrollToLessonPanel]
  );

  const closeLesson = useCallback(() => {
    setSuccessBanner('');
    setSearchParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const handleToggleSection = useCallback((sectionId) => {
    setExpandedSectionId((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const handleResume = useCallback(() => {
    if (awaitingFullPayment) return;
    const target =
      nextTaskState?.task?.id ||
      taskStates.find((t) => t.status !== 'locked' && !t.isComplete)?.task?.id ||
      taskStates.find((t) => t.status !== 'locked')?.task?.id ||
      taskStates[0]?.task?.id;
    if (target) openTask(target);
  }, [awaitingFullPayment, nextTaskState, taskStates, openTask]);

  const handleActionComplete = useCallback(
    (result) => {
      if (!result?.message) return;

      const nextId = result.blocked ? null : getNextTaskId(result.taskId);
      const sequentialNext = getNextSequentialTaskState(result.taskId);
      const paymentReminder =
        result.paymentRequired ||
        (!nextId && sequentialNext?.phaseLocked)
          ? ' Phase 2 and beyond unlock after full program payment — contact Payment support when ready.'
          : '';

      const message = `${result.message}${paymentReminder}`;

      if (lessonIdFromUrl) {
        setSuccessBanner(
          nextId && !result.blocked
            ? `${message} Tap Next lesson below when you're ready.`
            : message
        );
      } else {
        setToast(message);
        if (!result.reviewRequired) {
          setSuccessBanner(
            nextId && !result.blocked
              ? `${message} Continue to the next lesson when ready.`
              : message
          );
        } else {
          setSuccessBanner(message);
        }
      }
    },
    [getNextTaskId, getNextSequentialTaskState, lessonIdFromUrl]
  );

  const goToNextTask = useCallback(() => {
    if (!activeTaskId) return;
    const nextId = getNextTaskId(activeTaskId);
    if (nextId) openTask(nextId);
  }, [activeTaskId, getNextTaskId, openTask]);

  const goToPreviousTask = useCallback(() => {
    if (!activeTaskId) return;
    const prevId = getPrevTaskId(activeTaskId);
    if (prevId) openTask(prevId);
  }, [activeTaskId, getPrevTaskId, openTask]);

  const submissionCount = useMemo(() => countSavedSubmissions(taskStates), [taskStates]);

  if (isGuest) {
    return (
      <div className="page mbw-program-page">
        <GuestLockedPanel title="100BM program locked" />
      </div>
    );
  }

  if (enrolled === false) {
    return (
      <div className="page mbw-program-page">
        <div className="mbw-program-enroll">
          <h1>100 Board Members</h1>
          <p>Enrol in the 100BM program from Courses to access your journey.</p>
          <Link to="/app/home" className="btn btn-primary">
            Go to Courses
          </Link>
        </div>
      </div>
    );
  }

  const showFirstTime = !loading && !lessonMode && completedCount === 0;
  const resumeLabel = awaitingFullPayment
    ? 'Payment required'
    : completedCount === 0
      ? 'Start Onboarding'
      : 'Resume';

  return (
    <div
      className={`page mbw-program-page mbw-program-page--fade${
        lessonMode ? ' mbw-program-page--lesson' : ' mbw-program-page--overview'
      }`}
    >
      {!lessonMode && (
        <Link to="/app/home" className="back-link mbw-program-page__back">
          ← Courses
        </Link>
      )}

      {loading && taskStates.length === 0 ? (
        <MBWProgramSkeleton />
      ) : (
        <>
          {lessonMode && activeState ? (
            <BM100LessonTopbar
              cohortLabel={getCohortLabel(profile)}
              lessonTitle={getModuleLabel(activeState.task)}
              sectionPhase={activeState.task.phase}
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestones}
              onBack={closeLesson}
              onOpenOutline={() => setOutlineOpen(true)}
              showOutlineButton
            />
          ) : (
            <BM100ProgramHero
              cohortLabel={getCohortLabel(profile)}
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestones}
              nextTaskState={nextTaskState}
              onResume={handleResume}
              resumeLabel={resumeLabel}
              awaitingFullPayment={awaitingFullPayment}
            />
          )}

          {(error || hasLocalOnly) && (
            <div className="alert alert-warning mbw-program-page__sync">
              {error && <span>{error} </span>}
              {hasLocalOnly && (
                <span>
                  Some work is saved on this device only — admin cannot review until cloud sync works.{' '}
                </span>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={reload}>
                Retry sync
              </button>
            </div>
          )}

          {!lessonMode && awaitingFullPayment && (
            <div className="alert alert-warning mbw-program-page__payment-gate" role="status">
              <p>
                You have completed registration access (Onboarding + Phase 1). Phase 2 through Graduation
                unlock after full program payment.
              </p>
              <Link to="/app/support" className="btn btn-outline btn-sm">
                Payment support
              </Link>
            </div>
          )}

          <div
            className={`mbw-program-layout${
              lessonMode ? ' mbw-program-layout--lesson' : ' mbw-program-layout--overview'
            }`}
          >
            <div className="mbw-program-layout__main">
              {lessonMode && activeState ? (
                <BM100LessonView
                  activeState={activeState}
                  userId={user.uid}
                  threshold={WATCH_THRESHOLD}
                  successBanner={successBanner}
                  nextLessonTitle={nextLessonState?.task?.title}
                  showPrevCta={Boolean(prevFromCurrent)}
                  showNextCta={Boolean(
                    nextFromCurrent && (activeState.isComplete || activeState.task.optional)
                  )}
                  onBack={closeLesson}
                  onWatchProgress={setWatchProgressForTask}
                  onWatchComplete={() => markWatchComplete(activeState.task.id)}
                  onSubmit={(fields) => submitTask(activeState.task.id, fields)}
                  onSaveTemplate={(taskId, data) => saveTemplate(taskId, data)}
                  onAddRecurringPost={(link) => addRecurringPost(activeState.task.id, link)}
                  onActionComplete={handleActionComplete}
                  onGoToPrevious={openTask}
                  onPrevious={goToPreviousTask}
                  onNext={goToNextTask}
                />
              ) : (
                <BM100OverviewView
                  showFirstTime={showFirstTime}
                  onStartFirst={() => openTask(taskStates[0]?.task.id || 'bm100-wk1-4')}
                  profile={profile}
                  sectionProgress={sectionProgress}
                  expandedSectionId={expandedSectionId ?? currentSectionId}
                  currentSectionId={currentSectionId}
                  onToggleSection={handleToggleSection}
                  taskStates={taskStates}
                  nextTaskId={nextTaskId}
                  onSelectLesson={openTask}
                  submissionCount={submissionCount}
                  archiveOpen={archiveOpen}
                  onToggleArchive={() => setArchiveOpen((o) => !o)}
                  recordings={recordings}
                />
              )}
            </div>
          </div>

          {lessonMode && activeState && (
            <BM100LessonCurriculumDrawer
              open={outlineOpen}
              onClose={() => setOutlineOpen(false)}
              sectionProgress={sectionProgress}
              profile={profile}
              expandedSectionId={expandedSectionId ?? activeState.task.phase}
              currentSectionId={currentSectionId}
              onToggleSection={handleToggleSection}
              taskStates={taskStates}
              activeTaskId={activeTaskId}
              nextTaskId={nextTaskId}
              onSelectLesson={openTask}
            />
          )}
        </>
      )}

      <MBWToast message={lessonMode ? '' : toast} onClose={() => setToast('')} />
    </div>
  );
}
