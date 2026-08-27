import { DEFAULT_PROGRAM_UI } from '../../../data/programUiAdapters';
import MBWProgramProgressBand from '../../mbw/program/MBWProgramProgressBand';

/** Identity + progress only — the next action and its CTA live in ProgramNextStep. */
export default function BM100ProgramHero({
  cohortLabel,
  completedMilestones,
  totalMilestones,
  program = DEFAULT_PROGRAM_UI,
}) {
  const meta = program.meta;
  return (
    <header className="mbw-program-hero">
      <div className="mbw-program-hero__inner">
        <p className="mbw-program-hero__label">
          {meta.label} · {meta.duration} · {cohortLabel}
        </p>
        <h1 className="mbw-program-hero__title">{meta.title}</h1>
        <p className="mbw-program-hero__tagline">{meta.tagline}</p>

        <MBWProgramProgressBand
          completedMilestones={completedMilestones}
          totalMilestones={totalMilestones}
        />
      </div>
    </header>
  );
}
