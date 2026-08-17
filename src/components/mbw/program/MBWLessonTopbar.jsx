import { ListTree, ChevronLeft } from 'lucide-react';
import { MBW_PROGRAM_META, MBW_PROGRAM_SECTIONS } from '../../../data/mbwProgramStructure';
import MBWProgramProgressBand from './MBWProgramProgressBand';
import Breadcrumbs from '../../ui/Breadcrumbs';

function getSectionTitle(phase) {
  return MBW_PROGRAM_SECTIONS.find((s) => s.id === phase)?.title ?? 'MBW';
}

export default function MBWLessonTopbar({
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
    <header className="mbw-program-hero mbw-program-hero--lesson">
      <Breadcrumbs
        className="mbw-lesson-topbar__crumbs"
        items={[
          { label: 'Programs', href: '/app/home' },
          { label: MBW_PROGRAM_META.title, href: '/app/mbw' },
          ...(sectionTitle ? [{ label: sectionTitle }] : []),
          { label: lessonTitle || 'Lesson' },
        ]}
      />
      <div className="mbw-lesson-topbar__row">
        <button type="button" className="mbw-program-hero__back" onClick={onBack}>
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

      {/* Cohort only — the section is already the third crumb above. */}
      <p className="mbw-program-hero__label">{cohortLabel || MBW_PROGRAM_META.title}</p>
      {/*
        No heading here. The lesson name is the last crumb above and the card
        below carries it as the page's h1 — two h1s on one page is also wrong
        for screen readers. The hero's job is context and progress.
      */}
      <MBWProgramProgressBand
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      />
    </header>
  );
}
