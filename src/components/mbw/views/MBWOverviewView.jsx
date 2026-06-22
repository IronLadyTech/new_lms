import { ChevronDown } from 'lucide-react';
import MBWProgramJourney from '../program/MBWProgramJourney';
import MBWFirstTimePanel from '../program/MBWFirstTimePanel';
import MBWSubmissionsArchive from '../MBWSubmissionsArchive';

export default function MBWOverviewView({
  showFirstTime,
  onStartFirst,
  profile,
  sectionProgress,
  expandedSectionId,
  currentSectionId,
  onToggleSection,
  taskStates,
  nextTaskId,
  onSelectLesson,
  submissionCount,
  archiveOpen,
  onToggleArchive,
}) {
  return (
    <>
      {showFirstTime && <MBWFirstTimePanel onStart={onStartFirst} />}

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
      />

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
