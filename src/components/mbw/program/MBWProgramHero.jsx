import { ChevronRight } from 'lucide-react';
import { MBW_PROGRAM_META } from '../../../data/mbwProgramStructure';
import { getModuleLabel } from '../../../utils/mbwDisplay';
import MBWProgramProgressBand from './MBWProgramProgressBand';

export default function MBWProgramHero({
  cohortLabel,
  completedMilestones,
  totalMilestones,
  nextTaskState,
  onResume,
  resumeLabel = 'Resume',
}) {
  const showNext =
    nextTaskState && !nextTaskState.isComplete && nextTaskState.status !== 'locked';

  return (
    <header className="mbw-program-hero">
      <div className="mbw-program-hero__inner">
        <p className="mbw-program-hero__label">
          {MBW_PROGRAM_META.label} · {MBW_PROGRAM_META.duration} · {cohortLabel}
        </p>
        <h1 className="mbw-program-hero__title">{MBW_PROGRAM_META.title}</h1>
        <p className="mbw-program-hero__tagline">{MBW_PROGRAM_META.tagline}</p>

        <MBWProgramProgressBand
          completedMilestones={completedMilestones}
          totalMilestones={totalMilestones}
        />

        {showNext && (
          <p className="mbw-program-hero__next">
            <span className="mbw-program-hero__next-label">Next up</span>
            {getModuleLabel(nextTaskState.task)}
          </p>
        )}

        <button type="button" className="mbw-program-hero__resume btn btn-primary" onClick={onResume}>
          {resumeLabel} <ChevronRight size={18} />
        </button>
      </div>
    </header>
  );
}
