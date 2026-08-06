import { ChevronDown } from 'lucide-react';
import ProgramCourseContent from '../../mbw/program/ProgramCourseContent';
import BM100ProgramJourney from '../program/BM100ProgramJourney';
import BM100FirstTimePanel from '../program/BM100FirstTimePanel';
import ProgramNextStep from '../../mbw/program/ProgramNextStep';
import ProgramUpNext from '../../mbw/program/ProgramUpNext';
import MBWSubmissionsArchive from '../../mbw/MBWSubmissionsArchive';
import CourseRecordingsPanel from '../../course/CourseRecordingsPanel';
import { BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import {
  getLessonRowState,
  getTaskTypeIcon,
  getTaskDurationHint,
  getTaskKindLabel,
} from '../../../utils/bm100ProgramUtils';

export default function BM100OverviewView({
  showFirstTime,
  onStartFirst,
  profile,
  sectionProgress,
  expandedSectionId,
  currentSectionId,
  onToggleSection,
  taskStates,
  nextTaskState,
  nextTaskId,
  onSelectLesson,
  onResume,
  resumeLabel,
  awaitingFullPayment = false,
  completedMilestones,
  totalMilestones,
  submissionCount,
  archiveOpen,
  onToggleArchive,
  recordings = [],
}) {
  const phaseTitle = nextTaskState
    ? BM100_PROGRAM_SECTIONS.find((s) => s.id === nextTaskState.task.phase)?.title || null
    : null;

  // Only a payment block when there is genuinely nothing left to work on.
  const paymentBlocked = awaitingFullPayment && !nextTaskState;

  return (
    <>
      {showFirstTime && <BM100FirstTimePanel onStart={onStartFirst} />}

      <ProgramNextStep
        nextTaskState={nextTaskState}
        phaseTitle={phaseTitle}
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
        blockedMessage={
          paymentBlocked
            ? 'Full program payment unlocks Phase 2 through Graduation.'
            : null
        }
        blockedCta={
          paymentBlocked ? { label: 'Payment support', href: '/app/support' } : null
        }
        getTypeIcon={getTaskTypeIcon}
        getDurationHint={getTaskDurationHint}
        continueLabel={resumeLabel}
        onContinue={onResume}
      />

      <ProgramUpNext
        taskStates={taskStates}
        nextTaskId={nextTaskId}
        getRowState={(ts) => getLessonRowState(ts, nextTaskId, nextTaskId)}
        getTypeIcon={getTaskTypeIcon}
        getDurationHint={getTaskDurationHint}
        getKindLabel={getTaskKindLabel}
        onSelectLesson={onSelectLesson}
      />

      <ProgramCourseContent
        moduleCount={BM100_PROGRAM_SECTIONS.length}
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      >
        <BM100ProgramJourney
          sectionProgress={sectionProgress}
          profile={profile}
          expandedSectionId={expandedSectionId}
          currentSectionId={currentSectionId}
          onToggleSection={onToggleSection}
          taskStates={taskStates}
          activeTaskId={nextTaskId}
          nextTaskId={nextTaskId}
          onSelectLesson={onSelectLesson}
          autoScroll={false}
          embedded
        />
      </ProgramCourseContent>

      <div className="mbw-program-recordings">
        <CourseRecordingsPanel recordings={recordings} program={profile?.program || '100bm'} />
      </div>

      {submissionCount > 0 && (
        <section className="mbw-archive-panel mbw-program-card">
          <button
            type="button"
            className="mbw-archive-panel__toggle"
            aria-expanded={archiveOpen}
            onClick={onToggleArchive}
          >
            <span>
              My submissions
              <span className="mbw-archive-panel__count">{submissionCount}</span>
            </span>
            <ChevronDown
              size={18}
              className={`mbw-archive-panel__chevron${archiveOpen ? ' is-open' : ''}`}
              aria-hidden
            />
          </button>
          {archiveOpen && (
            <div className="mbw-archive-panel__body">
              <MBWSubmissionsArchive taskStates={taskStates} onOpenTask={onSelectLesson} compact />
            </div>
          )}
        </section>
      )}
    </>
  );
}
