import { useEffect, useState } from 'react';
import { getGroupsByProgram } from '../../services/groupService';
import { PROGRAM_OPTIONS } from '../../data/programTypes';

/**
 * Admin-only enrollment headcount — unique learners across all program batches.
 */
export default function CxProgramEnrollmentBar({ enabled }) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTotal(0);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const members = new Set();
        const batchesByProgram = await Promise.all(
          PROGRAM_OPTIONS.map(({ value }) => getGroupsByProgram(value))
        );
        batchesByProgram.flat().forEach((b) => {
          (b.memberIds || []).forEach((id) => members.add(id));
        });
        if (!cancelled) setTotal(members.size);
      } catch {
        if (!cancelled) setTotal(0);
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
    <section className="cx-panel cx-program-enrollment" aria-label="Learners enrolled">
      <div className="cx-panel__head">
        <h2 className="cx-panel__title">Learners enrolled</h2>
      </div>
      <div className="cx-panel__body">
        {loading ? (
          <div className="cx-program-enrollment__total cx-kpi--skeleton" aria-busy="true" />
        ) : (
          <div className="cx-program-enrollment__total">
            <span className="cx-program-enrollment__value">{total}</span>
            <span className="cx-program-enrollment__metric-label">
              {total === 1 ? 'learner' : 'learners'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
