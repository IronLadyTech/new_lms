import { useEffect, useMemo, useRef } from 'react';
import { BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import BM100ProgramSection from './BM100ProgramSection';

function sectionMatchesQuery(section, sectionTasks, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (section.title.toLowerCase().includes(q)) return true;
  return sectionTasks.some((ts) => (ts.task.title || '').toLowerCase().includes(q));
}

function filterTasksByQuery(sectionTasks, query) {
  if (!query?.trim()) return sectionTasks;
  const q = query.trim().toLowerCase();
  return sectionTasks.filter((ts) => (ts.task.title || '').toLowerCase().includes(q));
}

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
  embedded = false,
  searchQuery = '',
}) {
  const currentRef = useRef(null);
  const q = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return BM100_PROGRAM_SECTIONS.map((section, index) => {
      const sectionTasks = section.usesTaskEngine
        ? taskStates.filter((t) => t.task.phase === section.id)
        : [];
      const titleMatch = q && section.title.toLowerCase().includes(q);
      const matches = sectionMatchesQuery(section, sectionTasks, q);
      const filteredTasks = !q
        ? sectionTasks
        : titleMatch
          ? sectionTasks
          : filterTasksByQuery(sectionTasks, q);
      return { section, index, sectionTasks: filteredTasks, matches };
    }).filter((row) => row.matches);
  }, [taskStates, q]);

  useEffect(() => {
    if (!autoScroll || !currentRef.current) return;
    currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [autoScroll, currentSectionId, expandedSectionId, q]);

  return (
    <nav className="mbw-program-journey" aria-label="100BM program curriculum">
      {!embedded && <h2 className="mbw-program-journey__title">Your journey</h2>}
      <div className="mbw-program-journey__sections">
        {visibleSections.length === 0 ? (
          <p className="lesson-course-rail__empty muted">No lessons match your search.</p>
        ) : (
          visibleSections.map(({ section, index, sectionTasks }) => {
            const forceExpand = Boolean(q) || expandedSectionId === section.id;
            return (
              <div
                key={section.id}
                ref={section.id === currentSectionId ? currentRef : undefined}
              >
                <BM100ProgramSection
                  section={section}
                  sectionIndex={index + 1}
                  sectionProgress={sectionProgress}
                  profile={profile}
                  expanded={forceExpand}
                  isCurrent={section.id === currentSectionId}
                  taskStates={sectionTasks}
                  activeTaskId={activeTaskId}
                  nextTaskId={nextTaskId}
                  onToggle={() => onToggleSection(section.id)}
                  onSelectLesson={onSelectLesson}
                  railMode={embedded}
                />
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
}
