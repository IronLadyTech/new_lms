import { MBW_PROGRAM_META } from '../../../data/mbwProgramStructure';
import MBWProgramProgressBand from './MBWProgramProgressBand';

/** Identity + progress only — the next action and its CTA live in ProgramNextStep. */
export default function MBWProgramHero({ cohortLabel, completedMilestones, totalMilestones }) {
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
      </div>
    </header>
  );
}
