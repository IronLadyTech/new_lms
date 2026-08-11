import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Task-wise breakdown for one module: each task shows a completion bar and
 * clickable "done / pending" counts (drill into the participant list).
 * Consumes rows from cxMetrics.buildModuleTaskBreakdown (real submission data).
 */
export default function ModuleTaskWise({ module, onShowParticipants, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { title, subtitle, completionPct, taskRows } = module;

  if (!taskRows?.length) return null;

  return (
    <div className={`cx-module${open ? ' cx-module--open' : ''}`}>
      <button type="button" className="cx-module__head" onClick={() => setOpen((v) => !v)}>
        <div className="cx-module__titles">
          <span className="cx-module__title">{title}</span>
          {subtitle && <span className="cx-module__subtitle muted">{subtitle}</span>}
        </div>
        <div className="cx-module__meta">
          <span className="cx-module__count">{taskRows.length} tasks</span>
          <span className="cx-module__pct">{completionPct}% done</span>
          <ChevronDown size={16} className="cx-module__chev-icon" aria-hidden />
        </div>
      </button>

      {open && (
        <ul className="cx-taskwise">
          {taskRows.map((row, i) => {
            const doneCount = row.completed.length;
            const pendingCount = row.notCompleted.length;
            const total = doneCount + pendingCount;
            const pct = total ? Math.round((doneCount / total) * 100) : 0;
            return (
              <li key={row.task.id} className="cx-taskwise__row">
                <span className="cx-taskwise__num">{i + 1}</span>
                <div className="cx-taskwise__main">
                  <span className="cx-taskwise__title">{row.task.title}</span>
                  <div className="cx-taskwise__bar" role="img" aria-label={`${pct}% completed`}>
                    <div className="cx-taskwise__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="cx-taskwise__stats">
                  <button
                    type="button"
                    className="cx-count-btn cx-count-btn--done"
                    disabled={!doneCount}
                    onClick={() =>
                      onShowParticipants(`Completed — ${row.task.title}`, row.completed)
                    }
                  >
                    {doneCount} done
                  </button>
                  <button
                    type="button"
                    className="cx-count-btn cx-count-btn--pending"
                    disabled={!pendingCount}
                    onClick={() =>
                      onShowParticipants(`Pending — ${row.task.title}`, row.notCompleted)
                    }
                  >
                    {pendingCount} pending
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
