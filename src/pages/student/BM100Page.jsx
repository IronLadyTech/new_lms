import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useBm100TaskEngine from '../../hooks/useBm100TaskEngine';
import useBm100Enrollment from '../../hooks/useBm100Enrollment';
import useBatchRecordings from '../../hooks/useBatchRecordings';
import MBWToast from '../../components/mbw/MBWToast';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ProgramLockedPanel from '../../components/ProgramLockedPanel';
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
import { getProgramAccessState } from '../../utils/programAccess';
import { applyBatchRecordingsToTaskStates } from '../../utils/batchRecordingSessions';
import { PROGRAMS } from '../../data/programTypes';
import LessonSearchDialog from '../../components/ui/LessonSearchDialog';
import { useLessonSearchShortcut } from '../../hooks/useLessonSearchShortcut';

/*
 * The dialog hands its callback a taskState, not a task. Passing getModuleLabel
 * straight in read .order and .title off the wrapper, so every row rendered as
 * "Module 1 — undefined" — and since the same label is what the query filters
 * on, the search matched nothing.
 */
const lessonSearchLabel = (ts) => getModuleLabel(ts?.task ?? ts);

export default function BM100Page() {
  const { user, profile, isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enrolled, courses } = useBm100Enrollment();
  const { recordings } = useBatchRecordings();

  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  useLessonSearchShortcut(openSearch);

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
  const completedMilestones = useMemo(
    () => getCompletedMilestones(sectionProgress),
    [sectionProgress]
  );
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
      mergedTaskStates.find((t) => t.status !== 'locked' && !t.isComplete)?.task?.id ||
      mergedTaskStates.find((t) => t.status !== 'locked')?.task?.id ||
      mergedTaskStates[0]?.task?.id;
    if (target) openTask(target);
  }, [awaitingFullPayment, nextTaskState, mergedTaskStates, openTask]);

  const handleActionComplete = useCallback(
    (result) => {
      if (!result?.message) return;

      const nextId = result.blocked ? null : getNextTaskId(result.taskId);
      const sequentialNext = getNextSequentialTaskState(result.taskId);
      const paymentReminder =
        result.paymentRequired || (!nextId && sequentialNext?.phaseLocked)
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

  const submissionCount = useMemo(
    () => countSavedSubmissions(mergedTaskStates),
    [mergedTaskStates]
  );

  if (isGuest) {
    return (
      <div className="page mbw-program-page">
        <GuestLockedPanel title="100BM program locked" />
      </div>
    );
  }

  if (enrolled === false) {
    const access = getProgramAccessState(PROGRAMS.BM100, profile, courses);
    return (
      <div className="page mbw-program-page">
        <ProgramLockedPanel
          title="100BM is locked for your account"
          message={access.message}
          state={access.state}
          programLabel="100BM"
        />
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

      {loading && mergedTaskStates.length === 0 ? (
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
            <>
              <BM100ProgramHero
                cohortLabel={getCohortLabel(profile)}
                completedMilestones={completedMilestones}
                totalMilestones={totalMilestones}
              />
              {/*
               * Styled as a search field, not a button (UX-03). It opens the
               * search dialogue, but a control that looks like a field is what
               * makes people realise search exists at all.
               */}
              <button
                type="button"
                className="lesson-search-trigger"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={18} aria-hidden="true" className="lesson-search-trigger__icon" />
                <span className="lesson-search-trigger__text">Search lessons and sections</span>
                <kbd className="lesson-search-trigger__kbd">Ctrl K</kbd>
              </button>
            </>
          )}

          {(error || hasLocalOnly) && (
            <div className="alert alert-warning mbw-program-page__sync">
              {error && <span>{error} </span>}
              {hasLocalOnly && (
                <span>
                  Some work is saved on this device only — admin cannot review until cloud sync
                  works.{' '}
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
                You have completed registration access (Onboarding + Phase 1). Phase 2 through
                Graduation unlock after full program payment.
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
                  onStartFirst={() => openTask(mergedTaskStates[0]?.task.id || 'bm100-wk1-4')}
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
                  awaitingFullPayment={awaitingFullPayment}
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
            <BM100LessonCurriculumDrawer
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
      <LessonSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        taskStates={mergedTaskStates}
        programLabel="100BM"
        getTaskLabel={lessonSearchLabel}
        onSelect={openTask}
      />
    </div>
  );
}
