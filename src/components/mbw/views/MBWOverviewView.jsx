import { ChevronDown } from 'lucide-react';
import ProgramCourseContent from '../program/ProgramCourseContent';
import MBWProgramJourney from '../program/MBWProgramJourney';
import MBWFirstTimePanel from '../program/MBWFirstTimePanel';
import ProgramNextStep from '../program/ProgramNextStep';
import ProgramUpNext from '../program/ProgramUpNext';
import MBWSubmissionsArchive from '../MBWSubmissionsArchive';
import CourseRecordingsPanel from '../../course/CourseRecordingsPanel';
import { MBW_PROGRAM_SECTIONS } from '../../../data/mbwProgramStructure';
import {
  getLessonRowState,
  getTaskTypeIcon,
  getTaskDurationHint,
  getTaskKindLabel,
} from '../../../utils/mbwProgramUtils';

export default function MBWOverviewView({
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
  completedMilestones,
  totalMilestones,
  submissionCount,
  archiveOpen,
  onToggleArchive,
  recordings = [],
}) {
  const phaseTitle = nextTaskState
    ? MBW_PROGRAM_SECTIONS.find((s) => s.id === nextTaskState.task.phase)?.title || null
    : null;

  return (
    <>
      {showFirstTime && <MBWFirstTimePanel onStart={onStartFirst} />}

      <ProgramNextStep
        nextTaskState={nextTaskState}
        phaseTitle={phaseTitle}
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
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
        moduleCount={MBW_PROGRAM_SECTIONS.length}
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      >
        <MBWProgramJourney
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
        <CourseRecordingsPanel recordings={recordings} program={profile?.program || 'mbw'} />
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
