import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BM100_PROGRAM_META } from '../../../data/bm100ProgramStructure';
import { getModuleLabel } from '../../../utils/mbwDisplay';
import MBWProgramProgressBand from '../../mbw/program/MBWProgramProgressBand';

export default function BM100ProgramHero({
  cohortLabel,
  completedMilestones,
  totalMilestones,
  nextTaskState,
  onResume,
  resumeLabel = 'Resume',
  awaitingFullPayment = false,
}) {
  const showNext =
    !awaitingFullPayment &&
    nextTaskState &&
    !nextTaskState.isComplete &&
    nextTaskState.status !== 'locked';

  return (
    <header className="mbw-program-hero">
      <div className="mbw-program-hero__inner">
        <p className="mbw-program-hero__label">
          {BM100_PROGRAM_META.label} · {BM100_PROGRAM_META.duration} · {cohortLabel}
        </p>
        <h1 className="mbw-program-hero__title">{BM100_PROGRAM_META.title}</h1>
        <p className="mbw-program-hero__tagline">{BM100_PROGRAM_META.tagline}</p>

        <MBWProgramProgressBand
          completedMilestones={completedMilestones}
          totalMilestones={totalMilestones}
        />

        {awaitingFullPayment ? (
          <p className="mbw-program-hero__next">
            <span className="mbw-program-hero__next-label">Next up</span>
            Full program payment unlocks Phase 2
          </p>
        ) : showNext ? (
          <p className="mbw-program-hero__next">
            <span className="mbw-program-hero__next-label">Next up</span>
            {getModuleLabel(nextTaskState.task)}
          </p>
        ) : null}

        {awaitingFullPayment ? (
          <Link to="/app/support" className="mbw-program-hero__resume btn btn-primary">
            Payment support <ChevronRight size={18} />
          </Link>
        ) : (
          <button type="button" className="mbw-program-hero__resume btn btn-primary" onClick={onResume}>
            {resumeLabel} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
