import { useEffect, useRef } from 'react';
import { BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import BM100ProgramSection from './BM100ProgramSection';

export default function BM100ProgramJourney({
  sectionProgress,
  profile,
  expandedSectionId,
  currentSectionId,
  onToggleSection,
  taskStates,
  activeTaskId,
  nextTaskId,
  onSelectLesson,
  autoScroll = true,
}) {
  const currentRef = useRef(null);

  useEffect(() => {
    if (!autoScroll || !currentRef.current) return;
    currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [autoScroll, currentSectionId, expandedSectionId]);

  return (
    <nav className="mbw-program-journey" aria-label="100BM program curriculum">
      <h2 className="mbw-program-journey__title">Your journey</h2>
      <div className="mbw-program-journey__sections">
        {BM100_PROGRAM_SECTIONS.map((section) => (
          <div
            key={section.id}
            ref={section.id === currentSectionId ? currentRef : undefined}
          >
            <BM100ProgramSection
              section={section}
              sectionProgress={sectionProgress}
              profile={profile}
              expanded={expandedSectionId === section.id}
              isCurrent={section.id === currentSectionId}
              taskStates={section.usesTaskEngine ? taskStates.filter((t) => t.task.phase === section.id) : []}
              activeTaskId={activeTaskId}
              nextTaskId={nextTaskId}
              onToggle={() => onToggleSection(section.id)}
              onSelectLesson={onSelectLesson}
            />
          </div>
        ))}
      </div>
    </nav>
  );
}
