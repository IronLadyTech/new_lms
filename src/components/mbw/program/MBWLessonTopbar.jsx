import { MBW_PROGRAM_META } from '../../../data/mbwProgramStructure';
import MBWProgramProgressBand from './MBWProgramProgressBand';
export default function MBWLessonTopbar({
  cohortLabel,
  lessonTitle,
  completedMilestones,
  totalMilestones,
  onBack,
}) {
  return (
    <header className="mbw-program-hero mbw-program-hero--lesson">
      <button type="button" className="mbw-program-hero__back" onClick={onBack}>
        ← Back to program
      </button>
      <p className="mbw-program-hero__label">
        {MBW_PROGRAM_META.label} · {MBW_PROGRAM_META.duration} · {cohortLabel}
      </p>
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
