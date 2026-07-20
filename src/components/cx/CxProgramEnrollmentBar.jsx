import { useEffect, useState } from 'react';
import { getGroupsByProgram } from '../../services/groupService';
import { PROGRAM_OPTIONS, getProgramShortLabel } from '../../data/programTypes';

/** Admin-only cross-program enrollment summary. */
export default function CxProgramEnrollmentBar({ enabled }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const results = await Promise.all(
          PROGRAM_OPTIONS.map(async ({ value }) => {
            const batches = await getGroupsByProgram(value);
            const members = new Set();
            batches.forEach((b) => (b.memberIds || []).forEach((id) => members.add(id)));
            return {
              program: value,
              label: getProgramShortLabel(value),
              batches: batches.length,
              participants: members.size,
            };
          })
        );
        if (!cancelled) setRows(results);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <section className="cx-panel cx-program-enrollment" aria-label="Program enrollment">
      <div className="cx-panel__head">
        <h2 className="cx-panel__title">Program enrollment</h2>
        <span className="muted cx-panel__meta">All Iron Lady programs</span>
      </div>
      <div className="cx-panel__body">
        {loading ? (
          <div className="cx-program-enrollment__grid" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cx-program-enrollment__card cx-kpi--skeleton" />
            ))}
          </div>
        ) : (
          <div className="cx-program-enrollment__grid">
            {rows.map((row) => (
              <div
                key={row.program}
                className={`cx-program-enrollment__card cx-program-enrollment__card--${row.program.replace(/[^a-z0-9]/gi, '')}`}
              >
                <span className="cx-program-enrollment__label">{row.label}</span>
                <span className="cx-program-enrollment__value">{row.participants}</span>
                <span className="cx-program-enrollment__hint muted">
                  {row.participants === 1 ? 'participant' : 'participants'} · {row.batches}{' '}
                  {row.batches === 1 ? 'batch' : 'batches'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
