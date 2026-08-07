import { ListTree, ChevronLeft } from 'lucide-react';
import { BM100_PROGRAM_META, BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import MBWProgramProgressBand from '../../mbw/program/MBWProgramProgressBand';
import Breadcrumbs from '../../ui/Breadcrumbs';

function getSectionTitle(phase) {
  return BM100_PROGRAM_SECTIONS.find((s) => s.id === phase)?.title ?? '100BM';
}

export default function BM100LessonTopbar({
  cohortLabel,
  lessonTitle,
  sectionPhase,
  completedMilestones,
  totalMilestones,
  onBack,
  onOpenOutline,
  showOutlineButton = false,
}) {
  const sectionTitle = sectionPhase ? getSectionTitle(sectionPhase) : null;

  return (
    <header className="mbw-lesson-topbar">
      <Breadcrumbs
        className="mbw-lesson-topbar__crumbs"
        items={[
          { label: 'Programs', href: '/app/home' },
          { label: BM100_PROGRAM_META.title, href: '/app/100bm' },
          ...(sectionTitle ? [{ label: sectionTitle }] : []),
          { label: lessonTitle || 'Lesson' },
        ]}
      />
      <div className="mbw-lesson-topbar__row">
        <button type="button" className="mbw-lesson-topbar__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" />
          Back to program
        </button>
        {showOutlineButton && (
          <button
            type="button"
            className="mbw-lesson-topbar__outline btn btn-outline btn-sm"
            onClick={onOpenOutline}
            aria-label="Open course outline"
          >
            <ListTree size={16} aria-hidden />
            Outline
          </button>
        )}
      </div>

      <p className="mbw-lesson-topbar__label">
        {BM100_PROGRAM_META.label} · {cohortLabel}
      </p>

      {sectionTitle && (
        <p className="mbw-lesson-topbar__section">
          <strong>{sectionTitle}</strong>
        </p>
      )}

      {lessonTitle && <h1 className="mbw-lesson-topbar__title">{lessonTitle}</h1>}

      <MBWProgramProgressBand
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      />
    </header>
  );
}
