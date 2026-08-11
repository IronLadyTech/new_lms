import { STUCK_DAYS } from '../../utils/cxLearnerStage';

function timeAgo(ts) {
  const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toMillis?.() || null;
  if (!ms) return 'Never';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}

function lastActiveLabel(stage) {
  if (stage.lastSubmissionMs) {
    const days = Math.floor((Date.now() - stage.lastSubmissionMs) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  }
  return timeAgo(stage.learner.lastActivityAt);
}

function SectionPills({ sectionsSummary }) {
  return (
    <div className="cx-stage-pills">
      {sectionsSummary.map((section) => (
        <span
          key={section.id}
          className={`cx-stage-pill cx-stage-pill--${section.bucket}`}
          title={`${section.title}: ${section.label}`}
        >
          <span className="cx-stage-pill__name">{section.title.split(' ')[0]}</span>
          <span className="cx-stage-pill__val">{section.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function CxLearnerStageTable({
  stages = [],
  stageFilter = 'all',
  onStageFilterChange,
  sectionOptions = [],
  attendance = {},
  showAttendance = false,
}) {
  const stuckCount = stages.filter((s) => s.stuck).length;

  return (
    <div className="cx-learner-stage">
      <div className="cx-learner-stage__toolbar">
        <label className="cx-board__filter">
          Show{' '}
          <select value={stageFilter} onChange={(e) => onStageFilterChange?.(e.target.value)}>
            <option value="all">All learners</option>
            <option value="stuck">Stuck ({STUCK_DAYS}+ days)</option>
            <option value="complete">All sections complete</option>
            {sectionOptions.map((section) => (
              <option key={section.id} value={`section:${section.id}`}>
                Active in {section.title}
              </option>
            ))}
          </select>
        </label>
        {stuckCount > 0 && stageFilter !== 'stuck' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onStageFilterChange?.('stuck')}
          >
            {stuckCount} stuck
          </button>
        )}
      </div>

      {stages.length === 0 ? (
        <p className="muted">No learners match this filter.</p>
      ) : (
        <>
          <ul className="cx-learner-cards" aria-label="Learners by stage">
            {stages.map((stage) => {
              const att = attendance[stage.learner.id];
              const attPct = att?.total > 0 ? Math.round((att.present / att.total) * 100) : null;
              return (
                <li
                  key={stage.learner.id}
                  className={`cx-learner-card${stage.stuck ? ' cx-learner-card--stuck' : ''}`}
                >
                  <div className="cx-learner-card__head">
                    <span className="cx-learner-name">
                      {stage.learner.displayName || stage.learner.email}
                    </span>
                    {stage.stuck && <span className="cx-badge cx-badge--danger">Stuck</span>}
                  </div>
                  <p className="cx-learner-card__stage">{stage.stageLabel}</p>
                  {stage.nextTask && (
                    <p className="cx-learner-card__next muted">Next: {stage.nextTask.title}</p>
                  )}
                  <SectionPills sectionsSummary={stage.sectionsSummary} />
                  <div className="cx-learner-card__meta-row muted">
                    <span>Last active: {lastActiveLabel(stage)}</span>
                    <span>
                      Tasks:{' '}
                      <span
                        className={stage.allSectionsDone ? 'cx-badge cx-badge--done' : undefined}
                      >
                        {stage.completedTaskCount}/{stage.totalTasks}
                      </span>
                    </span>
                    {showAttendance && (
                      <span>
                        Attendance:{' '}
                        {attPct != null ? (
                          <span
                            className={
                              attPct < 60
                                ? 'cx-badge cx-badge--danger'
                                : attPct >= 80
                                  ? 'cx-badge cx-badge--done'
                                  : undefined
                            }
                          >
                            {attPct}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="cx-learner-table-wrap cx-learner-table-wrap--desktop">
            <table className="cx-learner-table cx-learner-table--stage">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Current stage</th>
                  <th>Section progress</th>
                  <th>Next task</th>
                  <th>Last active</th>
                  <th>Tasks</th>
                  {showAttendance && <th>Attendance</th>}
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => {
                  const att = attendance[stage.learner.id];
                  const attPct =
                    att?.total > 0 ? Math.round((att.present / att.total) * 100) : null;
                  return (
                    <tr
                      key={stage.learner.id}
                      className={stage.stuck ? 'cx-learner-row--stuck' : undefined}
                    >
                      <td>
                        <span className="cx-learner-name">
                          {stage.learner.displayName || stage.learner.email}
                        </span>
                        <span className="cx-learner-sub">
                          {stage.learner.phone || stage.learner.email}
                        </span>
                        {stage.stuck && <span className="cx-badge cx-badge--danger">Stuck</span>}
                      </td>
                      <td>{stage.stageLabel}</td>
                      <td>
                        <SectionPills sectionsSummary={stage.sectionsSummary} />
                      </td>
                      <td className="cx-learner-meta">{stage.nextTask?.title || '—'}</td>
                      <td className="cx-learner-meta">{lastActiveLabel(stage)}</td>
                      <td>
                        <span
                          className={
                            stage.allSectionsDone ? 'cx-badge cx-badge--done' : 'cx-learner-meta'
                          }
                        >
                          {stage.completedTaskCount}/{stage.totalTasks}
                        </span>
                      </td>
                      {showAttendance && (
                        <td>
                          {attPct != null ? (
                            <span
                              className={
                                attPct < 60
                                  ? 'cx-badge cx-badge--danger'
                                  : attPct >= 80
                                    ? 'cx-badge cx-badge--done'
                                    : 'cx-learner-meta'
                              }
                            >
                              {attPct}%
                            </span>
                          ) : (
                            <span className="cx-learner-meta">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
