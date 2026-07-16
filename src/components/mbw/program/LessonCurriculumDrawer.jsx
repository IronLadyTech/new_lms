import { X } from 'lucide-react';
import MBWProgramJourney from './MBWProgramJourney';

export default function LessonCurriculumDrawer({
  open,
  onClose,
  sectionProgress,
  profile,
  expandedSectionId,
  currentSectionId,
  onToggleSection,
  taskStates,
  activeTaskId,
  nextTaskId,
  onSelectLesson,
}) {
  if (!open) return null;

  const handleSelect = (taskId) => {
    onSelectLesson(taskId);
    onClose();
  };

  return (
    <div className="lesson-curriculum-drawer" role="presentation">
      <button
        type="button"
        className="lesson-curriculum-drawer__backdrop"
        aria-label="Close outline"
        onClick={onClose}
      />
      <aside
        className="lesson-curriculum-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-curriculum-title"
      >
        <header className="lesson-curriculum-drawer__head">
          <h2 id="lesson-curriculum-title">Course outline</h2>
          <button type="button" className="lesson-curriculum-drawer__close" onClick={onClose}>
            <X size={20} aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </header>
        <div className="lesson-curriculum-drawer__body">
          <MBWProgramJourney
            sectionProgress={sectionProgress}
            profile={profile}
            expandedSectionId={expandedSectionId}
            currentSectionId={currentSectionId}
            onToggleSection={onToggleSection}
            taskStates={taskStates}
            activeTaskId={activeTaskId}
            nextTaskId={nextTaskId}
            onSelectLesson={handleSelect}
            autoScroll
          />
        </div>
      </aside>
    </div>
  );
}
