import { getProgramProgressPct } from '../../../utils/mbwProgramUtils';

export default function MBWProgramProgressBand({ completedMilestones, totalMilestones }) {
  const pct = getProgramProgressPct(completedMilestones, totalMilestones);

  return (
    <div className="mbw-program-progress">
      <div className="mbw-program-progress__meta">
        <span className="mbw-program-progress__pct">{pct}%</span>
        <span className="mbw-program-progress__milestones">
          {completedMilestones} of {totalMilestones} milestones complete
        </span>
      </div>
      <div
        className="mbw-program-progress__bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="mbw-program-progress__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
