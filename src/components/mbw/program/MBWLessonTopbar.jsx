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

      <p className="mbw-program-hero__label">
        {cohortLabel ? `${cohortLabel} · ` : ''}
        {sectionTitle || MBW_PROGRAM_META.title}
      </p>
      <h1 className="mbw-program-hero__title mbw-program-hero__title--lesson">{lessonTitle}</h1>
      <MBWProgramProgressBand
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      />
    </header>
  );
}
