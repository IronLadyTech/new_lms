import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { isCxSubmissionComplete } from '../../utils/cxMetrics';
import { getSubmissionReviewDisplay } from '../../utils/submissionReview';

function statusCellClass(sub, done) {
  if (done) return 'mbw-admin-cell--done';
  const display = getSubmissionReviewDisplay(sub);
  if (display.tone === 'review') return 'mbw-admin-cell--review';
  if (display.tone === 'improvement') return 'mbw-admin-cell--improvement';
  if (display.tone === 'rejected') return 'mbw-admin-cell--rejected';
  if (sub?.status === SUBMISSION_STATUS.SUBMITTED) return 'mbw-admin-cell--submitted';
  if (sub?.status === SUBMISSION_STATUS.UNLOCKED) return 'mbw-admin-cell--open';
  return 'mbw-admin-cell--locked';
}

function statusShort(sub, done) {
  if (done) return 'Done';
  const display = getSubmissionReviewDisplay(sub);
  if (display.tone === 'review') return 'Review';
  if (display.tone === 'improvement') return 'Revise';
  if (display.tone === 'rejected') return 'Reject';
  if (sub?.status === SUBMISSION_STATUS.SUBMITTED || sub?.status === SUBMISSION_STATUS.UNDER_REVIEW) {
    return 'Submitted';
  }
  if (sub?.status === SUBMISSION_STATUS.UNLOCKED) return 'Open';
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
          <span className="cx-module__chev cx-module__chev-icon" aria-hidden>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
                    const done = isCxSubmissionComplete(sub, t);
                    const clickable = sub && onOpenSubmission;
                    return (
                      <td
                        key={t.id}
                        className={`mbw-admin-cell ${statusCellClass(sub, done)}`}
                        title={t.title}
                      >
                        {clickable ? (
                          <button
                            type="button"
                            className="cx-cell-btn"
                            onClick={() => onOpenSubmission(u.id, t.id)}
                          >
                            {statusShort(sub, done)}
                          </button>
                        ) : (
                          statusShort(sub, done)
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
