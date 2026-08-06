function FunnelSegment({ label, count, variant, onClick }) {
  return (
    <button
      type="button"
      className={`cx-stage-funnel__seg cx-stage-funnel__seg--${variant}${!count ? ' is-empty' : ''}`}
      disabled={!count || !onClick}
      onClick={() => count && onClick?.()}
    >
      <span className="cx-stage-funnel__seg-count">{count}</span>
      <span className="cx-stage-funnel__seg-label">{label}</span>
    </button>
  );
}

export default function CxBatchStageFunnel({ funnel = [], onSelectParticipants }) {
  if (!funnel.length) return null;

  return (
    <div className="cx-stage-funnel-stack">
      {funnel.map((section) => (
        <article key={section.id} className="cx-stage-funnel">
          <header className="cx-stage-funnel__head">
            <div>
              <h3 className="cx-stage-funnel__title">{section.title}</h3>
              {section.subtitle && <p className="cx-stage-funnel__sub muted">{section.subtitle}</p>}
            </div>
            <span className="cx-stage-funnel__total muted">{section.total} learners</span>
          </header>
          <div className="cx-stage-funnel__segments" role="group" aria-label={`${section.title} stage breakdown`}>
            <FunnelSegment
              label="Complete"
              count={section.complete.length}
              variant="done"
              onClick={() =>
                onSelectParticipants(`${section.title} — complete`, section.complete, {
                  filter: `bucket:${section.id}:complete`,
                })
              }
            />
            <FunnelSegment
              label="In progress"
              count={section.inProgress.length}
              variant="progress"
              onClick={() =>
                onSelectParticipants(`${section.title} — in progress`, section.inProgress, {
                  filter: `bucket:${section.id}:in_progress`,
                })
              }
            />
            <FunnelSegment
              label="Not started"
              count={section.notStarted.length}
              variant="open"
              onClick={() =>
                onSelectParticipants(`${section.title} — not started`, section.notStarted, {
                  filter: `bucket:${section.id}:not_started`,
                })
              }
            />
            <FunnelSegment
              label="Locked"
              count={section.locked.length}
              variant="locked"
              onClick={() =>
                onSelectParticipants(`${section.title} — locked`, section.locked, {
                  filter: `bucket:${section.id}:locked`,
                })
              }
            />
          </div>
        </article>
      ))}
    </div>
  );
}

