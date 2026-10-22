import { Flame, Lock, Medal, Trophy, ChevronRight } from 'lucide-react';

const STAT_ART = {
  'pie-chart': '/stitch-home/stats/pie-chart.png',
  'circle-check': '/stitch-home/stats/circle-check.png',
  stopwatch: '/stitch-home/stats/stopwatch.png',
  'award-ribbon': '/stitch-home/stats/award-ribbon.png',
};

const BADGE_ICONS = {
  trophy: Trophy,
  flame: Flame,
  medal: Medal,
  lock: Lock,
};

export default function StitchStatsAchievements({ statistics, achievements }) {
  return (
    <div className="sh-stats-achievements">
      <section className="sh-stack-col">
        <div className="sh-section-head">
          <h2 className="sh-section-title">My statistics</h2>
        </div>
        <div className="sh-stats-card">
          {statistics.map((stat) => {
            const artSrc = STAT_ART[stat.icon];
            const tone = stat.tone || 'blue';
            return (
              <div key={stat.id} className={`sh-stat sh-stat--${tone}`}>
                <div className="sh-stat__copy">
                  <p className="sh-stat__label">{stat.label}</p>
                  <p className="sh-stat__figure">
                    <span className="sh-stat__value">{stat.value}</span>
                    {stat.unit ? <span className="sh-stat__unit">{stat.unit}</span> : null}
                  </p>
                </div>
                <span className={`sh-stat__visual sh-stat__visual--${tone}`} aria-hidden>
                  <span className="sh-stat__halo" />
                  {artSrc ? (
                    <img className="sh-stat__art" src={artSrc} alt="" width={38} height={38} />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sh-stack-col">
        <div className="sh-section-head">
          <h2 className="sh-section-title">Achievements</h2>
          <a className="sh-link" href="#achievements">
            View all
          </a>
        </div>
        <div className="sh-achievements-card">
          <p className="sh-badge-label">Badges earned</p>
          <ul className="sh-badges">
            {achievements.badges.map((badge) => {
              const Icon = BADGE_ICONS[badge.icon] || Trophy;
              return (
                <li
                  key={badge.id}
                  className={`sh-badge sh-badge--${badge.tone}`}
                  title={badge.title}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only">{badge.title}</span>
                </li>
              );
            })}
          </ul>

          <p className="sh-badge-label">Leaderboard</p>
          <div className="sh-leader">
            <span className="sh-leader__rank">{achievements.leaderboard.rank}</span>
            <span className="sh-leader__who">
              <span className="sh-leader__name">{achievements.leaderboard.name}</span>
              <span className="sh-leader__meta">{achievements.leaderboard.meta}</span>
            </span>
            <ChevronRight size={10} strokeWidth={2} color="#5c5557" aria-hidden />
          </div>
        </div>
      </section>
    </div>
  );
}
