import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useTaskEngine from '../../hooks/useTaskEngine';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import MBWToast from '../../components/mbw/MBWToast';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import MBWProgramHero from '../../components/mbw/program/MBWProgramHero';
import MBWLessonTopbar from '../../components/mbw/program/MBWLessonTopbar';
import MBWProgramSkeleton from '../../components/mbw/program/MBWProgramSkeleton';
import MBWOverviewView from '../../components/mbw/views/MBWOverviewView';
import MBWLessonView from '../../components/mbw/views/MBWLessonView';
import { countSavedSubmissions } from '../../utils/mbwSubmissionUtils';
import {
  computeSectionProgress,
  getCurrentSectionId,
  getTotalMilestones,
  getCompletedMilestones,
  getCohortLabel,
} from '../../utils/mbwProgramUtils';
import { getModuleLabel } from '../../utils/mbwDisplay';

export default function MBWPage() {
  const { user, profile, isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enrolled } = useMbwEnrollment();

  const [expandedSectionId, setExpandedSectionId] = useState('pre-preparation');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const lessonIdFromUrl = searchParams.get('lesson');

  const engine = useTaskEngine(user?.uid);
  const {
    taskStates,
    loading,
    error,
    completedCount,
    nextTaskState,
    getNextTaskId,
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
      const panel = document.getElementById('mbw-lesson-panel');
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
    const target =
      nextTaskState?.task?.id ||
      taskStates.find((t) => t.status !== 'locked')?.task?.id ||
      taskStates[0]?.task?.id;
    if (target) openTask(target);
  }, [nextTaskState, taskStates, openTask]);

  const handleActionComplete = useCallback(
    (result) => {
      if (!result?.message) return;
      if (lessonIdFromUrl) {
        const nextId = getNextTaskId(result.taskId);
        setSuccessBanner(
          nextId ? `${result.message} Tap Next lesson below when you're ready.` : result.message
        );
      } else {
        setToast(result.message);
        if (!result.reviewRequired) {
          const nextId = getNextTaskId(result.taskId);
          setSuccessBanner(
            nextId ? `${result.message} Continue to the next lesson when ready.` : result.message
          );
        } else {
          setSuccessBanner(result.message);
        }
      }
    },
    [getNextTaskId, lessonIdFromUrl]
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
        <GuestLockedPanel title="MBW program locked" />
      </div>
    );
  }

  if (enrolled === false) {
    return (
      <div className="page mbw-program-page">
        <div className="mbw-program-enroll">
          <h1>Master of Business Warfare</h1>
          <p>Enrol in the 1-year MBW program from Courses to access your journey.</p>
          <Link to="/app/home" className="btn btn-primary">
            Go to Courses
          </Link>
        </div>
      </div>
    );
  }

  const showFirstTime = !loading && !lessonMode && completedCount === 0;
  const resumeLabel = completedCount === 0 ? 'Start Pre-Preparation' : 'Resume';

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
            <MBWLessonTopbar
              cohortLabel={getCohortLabel(profile)}
              lessonTitle={getModuleLabel(activeState.task)}
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestones}
              onBack={closeLesson}
            />
          ) : (
            <MBWProgramHero
              cohortLabel={getCohortLabel(profile)}
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestones}
              nextTaskState={nextTaskState}
              onResume={handleResume}
              resumeLabel={resumeLabel}
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

          <div
            className={`mbw-program-layout${
              lessonMode ? ' mbw-program-layout--lesson' : ' mbw-program-layout--overview'
            }`}
          >
            <div className="mbw-program-layout__main">
              {lessonMode && activeState ? (
                <MBWLessonView
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
                <MBWOverviewView
                  showFirstTime={showFirstTime}
                  onStartFirst={() => openTask(taskStates[0]?.task.id || 'mbw-orientation')}
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
                />
              )}
            </div>
          </div>
        </>
      )}

      <MBWToast message={lessonMode ? '' : toast} onClose={() => setToast('')} />
    </div>
  );
}
