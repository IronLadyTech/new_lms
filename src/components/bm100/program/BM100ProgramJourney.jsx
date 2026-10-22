import { useEffect, useMemo, useRef } from 'react';
import BM100ProgramSection from './BM100ProgramSection';
import { DEFAULT_PROGRAM_UI } from '../../../data/programUiAdapters';
import { matchesLessonFilter } from '../../../utils/lessonFilters';

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
  program = DEFAULT_PROGRAM_UI,
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
  statusFilter = 'all',
  showSubmissionTags = false,
  outline = 'cards',
}) {
  const currentRef = useRef(null);
  const q = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return program.sections
      .map((section, index) => {
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
        // A status filter narrows the lessons, and hides a module left with none.
        const shownTasks =
          statusFilter === 'all'
            ? filteredTasks
            : filteredTasks.filter((ts) => matchesLessonFilter(ts, statusFilter));
        return {
          section,
          index,
          sectionTasks: shownTasks,
          matches: matches && (statusFilter === 'all' || shownTasks.length > 0),
        };
      })
      .filter((row) => row.matches);
  }, [taskStates, q, statusFilter]);

  useEffect(() => {
    if (!autoScroll || !currentRef.current) return;
    currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [autoScroll, currentSectionId, expandedSectionId, q]);

  return (
    <nav className="mbw-program-journey" aria-label="100BM program curriculum">
      {!embedded && <h2 className="mbw-program-journey__title">Your journey</h2>}
      <div className="mbw-program-journey__sections">
        {visibleSections.length === 0 ? (
          <p className="lesson-course-rail__empty muted">
            {statusFilter !== 'all' && !q
              ? 'No lessons in this list yet.'
              : 'No lessons match your search.'}
          </p>
        ) : (
          visibleSections.map(({ section, index, sectionTasks }) => {
            const forceExpand =
              Boolean(q) || statusFilter !== 'all' || expandedSectionId === section.id;
            return (
              <div
                key={section.id}
                ref={section.id === currentSectionId ? currentRef : undefined}
              >
                <BM100ProgramSection
                  program={program}
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
                  showSubmissionTags={showSubmissionTags}
                  outline={outline}
                />
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
}
