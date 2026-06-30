import { useState } from 'react';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { isCxSubmissionComplete } from '../../utils/cxMetrics';

function statusCellClass(status) {
  if (status === SUBMISSION_STATUS.COMPLETED) return 'mbw-admin-cell--done';
  if (status === SUBMISSION_STATUS.UNDER_REVIEW) return 'mbw-admin-cell--review';
  if (status === SUBMISSION_STATUS.SUBMITTED) return 'mbw-admin-cell--submitted';
  if (status === SUBMISSION_STATUS.UNLOCKED) return 'mbw-admin-cell--open';
  return 'mbw-admin-cell--locked';
}

function statusShort(status) {
  if (status === SUBMISSION_STATUS.COMPLETED) return 'Done';
  if (status === SUBMISSION_STATUS.UNDER_REVIEW) return 'Review';
  if (status === SUBMISSION_STATUS.SUBMITTED) return 'Sent';
  if (status === SUBMISSION_STATUS.UNLOCKED) return 'Open';
  return '—';
}

export default function ModuleTaskGrid({
  module,
  students = [],
  subByUser = {},
  completionPct = 0,
  onOpenSubmission,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { tasks, title, subtitle } = module;

  if (!tasks?.length) return null;

  return (
    <div className={`cx-module${open ? ' cx-module--open' : ''}`}>
      <button type="button" className="cx-module__head" onClick={() => setOpen((v) => !v)}>
        <div className="cx-module__titles">
          <span className="cx-module__title">{title}</span>
          {subtitle && <span className="cx-module__subtitle muted">{subtitle}</span>}
        </div>
        <div className="cx-module__meta">
          <span className="cx-module__count">{tasks.length} tasks</span>
          <span className="cx-module__pct">{completionPct}% done</span>
          <span className="cx-module__chev" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {open && (
        <div className="cx-module__body progress-table-wrap">
          <table className="progress-table mbw-admin-grid">
            <thead>
              <tr>
                <th>Participant</th>
                {tasks.map((t, i) => (
                  <th key={t.id} title={t.title} className="mbw-admin-th">
                    <span className="mbw-admin-th__num">{i + 1}</span>
                    <span className="mbw-admin-th__name">{t.title.split(' ').slice(0, 2).join(' ')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="mbw-admin-name">{u.displayName || u.email}</span>
                    {u.batchName && <span className="mbw-admin-phone">{u.batchName}</span>}
                  </td>
                  {tasks.map((t) => {
                    const sub = subByUser[u.id]?.[t.id];
                    const st = sub?.status || SUBMISSION_STATUS.LOCKED;
                    const done = isCxSubmissionComplete(sub, t);
                    const clickable = sub && onOpenSubmission;
                    return (
                      <td
                        key={t.id}
                        className={`mbw-admin-cell ${statusCellClass(done ? SUBMISSION_STATUS.COMPLETED : st)}`}
                        title={t.title}
                      >
                        {clickable ? (
                          <button
                            type="button"
                            className="cx-cell-btn"
                            onClick={() => onOpenSubmission(u.id, t.id)}
                          >
                            {done ? 'Done' : statusShort(st)}
                          </button>
                        ) : (
                          done ? 'Done' : statusShort(st)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
