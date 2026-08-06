import { BM100_PROGRAM_META } from '../../../data/bm100ProgramStructure';
import MBWProgramProgressBand from '../../mbw/program/MBWProgramProgressBand';

/** Identity + progress only — the next action and its CTA live in ProgramNextStep. */
export default function BM100ProgramHero({ cohortLabel, completedMilestones, totalMilestones }) {
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
      </div>
    </header>
  );
}
