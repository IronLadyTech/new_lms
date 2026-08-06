import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useTaskEngine from '../../hooks/useTaskEngine';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import useBatchRecordings from '../../hooks/useBatchRecordings';
import MBWToast from '../../components/mbw/MBWToast';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ProgramLockedPanel from '../../components/ProgramLockedPanel';
import MBWProgramHero from '../../components/mbw/program/MBWProgramHero';
import MBWLessonTopbar from '../../components/mbw/program/MBWLessonTopbar';
import LessonCurriculumDrawer from '../../components/mbw/program/LessonCurriculumDrawer';
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
import { getProgramAccessState } from '../../utils/programAccess';
import { applyBatchRecordingsToTaskStates } from '../../utils/batchRecordingSessions';
import { PROGRAMS } from '../../data/programTypes';

export default function MBWPage() {
  const { user, profile, isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enrolled, courses } = useMbwEnrollment();
  const { recordings } = useBatchRecordings();

  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
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

  const mergedTaskStates = useMemo(
    () => applyBatchRecordingsToTaskStates(taskStates, recordings),
    [taskStates, recordings]
  );

  const sectionProgress = useMemo(
    () => computeSectionProgress(mergedTaskStates, profile),
    [mergedTaskStates, profile]
  );
  const currentSectionId = useMemo(() => getCurrentSectionId(sectionProgress), [sectionProgress]);
  const totalMilestones = useMemo(() => getTotalMilestones(sectionProgress), [sectionProgress]);
  const completedMilestones = useMemo(() => getCompletedMilestones(sectionProgress), [sectionProgress]);
  const nextTaskId = nextTaskState?.task?.id || null;

  const hasLocalOnly = useMemo(
    () => Object.values(submissions || {}).some((s) => s._local),
    [submissions]
  );

  const activeState = useMemo(
    () => (lessonIdFromUrl ? mergedTaskStates.find((t) => t.task.id === lessonIdFromUrl) : null),
    [mergedTaskStates, lessonIdFromUrl]
  );

  const lessonMode = Boolean(activeState);
  const activeTaskId = activeState?.task.id || null;
  const nextFromCurrent = activeTaskId ? getNextTaskId(activeTaskId) : null;
  const prevFromCurrent = activeTaskId ? getPrevTaskId(activeTaskId) : null;
  const nextLessonState = useMemo(
    () => (nextFromCurrent ? mergedTaskStates.find((t) => t.task.id === nextFromCurrent) : null),
    [nextFromCurrent, mergedTaskStates]
  );

  useEffect(() => {
    if (lessonIdFromUrl && mergedTaskStates.length && !activeState) {
      setSearchParams({}, { replace: true });
    }
  }, [lessonIdFromUrl, mergedTaskStates, activeState, setSearchParams]);

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
    const target =
      nextTaskState?.task?.id ||
      mergedTaskStates.find((t) => t.status !== 'locked')?.task?.id ||
      mergedTaskStates[0]?.task?.id;
    if (target) openTask(target);
  }, [nextTaskState, mergedTaskStates, openTask]);

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

  const submissionCount = useMemo(() => countSavedSubmissions(mergedTaskStates), [mergedTaskStates]);

  if (isGuest) {
    return (
      <div className="page mbw-program-page">
        <GuestLockedPanel title="MBW program locked" />
      </div>
    );
  }

  if (enrolled === false) {
    const access = getProgramAccessState(PROGRAMS.MBW, profile, courses);
    return (
      <div className="page mbw-program-page">
        <ProgramLockedPanel
          title="MBW is locked for your account"
          message={access.message}
          state={access.state}
          programLabel="MBW"
        />
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

      {loading && mergedTaskStates.length === 0 ? (
        <MBWProgramSkeleton />
      ) : (
        <>
          {lessonMode && activeState ? (
            <MBWLessonTopbar
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
            <MBWProgramHero
              cohortLabel={getCohortLabel(profile)}
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestones}
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
                  onStartFirst={() => openTask(mergedTaskStates[0]?.task.id || 'mbw-orientation')}
                  profile={profile}
                  sectionProgress={sectionProgress}
                  expandedSectionId={expandedSectionId ?? currentSectionId}
                  currentSectionId={currentSectionId}
                  onToggleSection={handleToggleSection}
                  taskStates={mergedTaskStates}
                  nextTaskState={nextTaskState}
                  nextTaskId={nextTaskId}
                  onSelectLesson={openTask}
                  onResume={handleResume}
                  resumeLabel={resumeLabel}
                  completedMilestones={completedMilestones}
                  totalMilestones={totalMilestones}
                  submissionCount={submissionCount}
                  archiveOpen={archiveOpen}
                  onToggleArchive={() => setArchiveOpen((o) => !o)}
                  recordings={recordings}
                />
              )}
            </div>
          </div>

          {lessonMode && activeState && (
            <LessonCurriculumDrawer
              open={outlineOpen}
              onClose={() => setOutlineOpen(false)}
              sectionProgress={sectionProgress}
              profile={profile}
              expandedSectionId={expandedSectionId ?? activeState.task.phase}
              currentSectionId={currentSectionId}
              onToggleSection={handleToggleSection}
              taskStates={mergedTaskStates}
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
