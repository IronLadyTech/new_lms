import { ListTree } from 'lucide-react';
import { MBW_PROGRAM_META, MBW_PROGRAM_SECTIONS } from '../../../data/mbwProgramStructure';
import MBWProgramProgressBand from './MBWProgramProgressBand';

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
      <div className="mbw-lesson-topbar__row">
        <button type="button" className="mbw-program-hero__back" onClick={onBack}>
          ← Back to program
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
        {MBW_PROGRAM_META.label} · {MBW_PROGRAM_META.duration} · {cohortLabel}
      </p>

      {sectionTitle && (
        <p className="mbw-lesson-topbar__section">
          <strong>{sectionTitle}</strong>
        </p>
      )}

      <h1 className="mbw-program-hero__title">{MBW_PROGRAM_META.title}</h1>
      <p className="mbw-program-hero__tagline">{MBW_PROGRAM_META.tagline}</p>

      <MBWProgramProgressBand
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
      />

      {lessonTitle && (
        <p className="mbw-program-hero__next">
          <span className="mbw-program-hero__next-label">Current lesson</span>
          {lessonTitle}
        </p>
      )}
    </header>
  );
}
