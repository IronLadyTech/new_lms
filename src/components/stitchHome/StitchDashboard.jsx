import StitchShell from './StitchShell';
import StitchContinueLearning from './StitchContinueLearning';
import StitchStatsAchievements from './StitchStatsAchievements';
import StitchHoursAndProgress from './StitchHoursAndProgress';
import StitchAnnouncement from './StitchAnnouncement';
import StitchPaymentBanner from './StitchPaymentBanner';
import StitchEventsRail from './StitchEventsRail';
import StitchProgrammes from './StitchProgrammes';
import StitchPracticeStreak from './StitchPracticeStreak';

/**
 * The learner dashboard body. The surrounding chrome lives in StitchShell.
 * Pass `data` shaped like the stitch home dashboard payload.
 */
export default function StitchDashboard({ data, onLogout }) {
  return (
    <StitchShell
      nav={data.nav}
      learner={data.learner}
      activeId={data.nav.activeId}
      onLogout={onLogout}
    >
      <div className="sh-primary">
        <div className="sh-primary__main">
          <StitchContinueLearning data={data.continueLearning} />
          <StitchStatsAchievements statistics={data.statistics} achievements={data.achievements} />
          <StitchHoursAndProgress
            hoursSpent={data.hoursSpent}
            progressTracks={data.progressTracks}
          />
          <StitchAnnouncement announcements={data.announcements} />
          <StitchPaymentBanner banner={data.paymentBanner} />
        </div>

        <StitchEventsRail calendar={data.calendar} events={data.events} activity={data.activity} />
      </div>

      <StitchProgrammes programmes={data.programmes} />
      <StitchPracticeStreak streak={data.practiceStreak} />
    </StitchShell>
  );
}
