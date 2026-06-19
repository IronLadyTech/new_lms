import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { filterStudentsForBatches } from '../../utils/batchScope';
import ParticipantListModal from '../../components/cx/ParticipantListModal';

export default function CXDashboards() {
  const { program, adapter } = useProgramAdapter();
  const { batches, students, tasks, submissions, loading } = useCxData(program, adapter);
  const [modal, setModal] = useState(null);
  const [taskBatchFilter, setTaskBatchFilter] = useState('all');

  const stats = useMemo(() => {
    const completed = submissions.filter((s) => s.status === SUBMISSION_STATUS.COMPLETED).length;
    const pending = submissions.filter((s) =>
      [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(s.status)
    ).length;
    const possible = students.length * tasks.length;
    return {
      completed,
      pending,
      completionRate: possible ? Math.round((completed / possible) * 100) : 0,
    };
  }, [submissions, students, tasks]);

  const perBatch = useMemo(
    () =>
      batches.map((b) => {
        const ids = new Set(b.memberIds || []);
        const subs = submissions.filter((s) => ids.has(s.userId));
        const done = subs.filter((s) => s.status === SUBMISSION_STATUS.COMPLETED).length;
        const possible = ids.size * tasks.length;
        return {
          batch: b,
          learners: ids.size,
          pct: possible ? Math.round((done / possible) * 100) : 0,
        };
      }),
    [batches, submissions, tasks]
  );

  // Students scoped to the selected batch (or all batches)
  const taskWiseStudents = useMemo(
    () => filterStudentsForBatches(students, batches, taskBatchFilter),
    [students, batches, taskBatchFilter]
  );

  const selectedBatchLabel = useMemo(() => {
    if (taskBatchFilter === 'all') return 'All batches';
    return batches.find((b) => b.id === taskBatchFilter)?.name || 'Selected batch';
  }, [taskBatchFilter, batches]);

  const perTaskBreakdown = useMemo(() => {
    if (!adapter.hasTasks) return [];
    const subMap = {};
    submissions.forEach((s) => {
      if (!subMap[s.userId]) subMap[s.userId] = {};
      subMap[s.userId][s.taskId] = s;
    });
    return tasks.map((t) => {
      const completed = taskWiseStudents.filter(
        (s) => subMap[s.id]?.[t.id]?.status === SUBMISSION_STATUS.COMPLETED
      );
      const notCompleted = taskWiseStudents.filter(
        (s) => subMap[s.id]?.[t.id]?.status !== SUBMISSION_STATUS.COMPLETED
      );
      return { task: t, completed, notCompleted };
    });
  }, [tasks, taskWiseStudents, submissions, adapter.hasTasks]);

  return (
    <div className="page cx-page">
      <h1>Dashboards</h1>
      <p className="page-sub">{getProgramLabel(program)} · overall metrics</p>

      {modal && (
        <ParticipantListModal
          title={modal.title}
          participants={modal.participants}
          onClose={() => setModal(null)}
        />
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <section className="cx-section">
            <div className="cx-stat-grid">
              <div className="cx-stat">
                <span className="cx-stat__value">{batches.length}</span>
                <span className="cx-stat__label">Batches</span>
              </div>
              <div className="cx-stat">
                <span className="cx-stat__value">{students.length}</span>
                <span className="cx-stat__label">Learners</span>
              </div>
              {adapter.hasTasks && (
                <>
                  <div className="cx-stat">
                    <span className="cx-stat__value">{stats.completionRate}%</span>
                    <span className="cx-stat__label">Completion</span>
                  </div>
                  <div className="cx-stat">
                    <span className="cx-stat__value">{stats.pending}</span>
                    <span className="cx-stat__label">Awaiting review</span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="cx-section">
            <h2>Batch comparison</h2>
            {perBatch.length === 0 ? (
              <p className="muted">No {adapter.shortLabel} batches yet.</p>
            ) : (
              perBatch.map(({ batch, learners, pct }) => (
                <Link key={batch.id} to={`/cx/batches/${batch.id}`} className="cx-bar cx-bar--link">
                  <div className="cx-bar__head">
                    <span className="cx-bar__label">{batch.name}</span>
                    <span className="muted">
                      {learners} learners{adapter.hasTasks ? ` · ${pct}%` : ''}
                    </span>
                  </div>
                  {adapter.hasTasks && (
                    <div className="cx-bar__track">
                      <div className="cx-bar__fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </Link>
              ))
            )}
          </section>

          {adapter.hasTasks && (
            <section className="cx-section">
              <div className="cx-section__head">
                <h2>Task-wise breakdown</h2>
                <label className="cx-board__filter">
                  Batch{' '}
                  <select
                    value={taskBatchFilter}
                    onChange={(e) => setTaskBatchFilter(e.target.value)}
                  >
                    <option value="all">All batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted cx-taskwise-sub">
                {selectedBatchLabel} · {taskWiseStudents.length} participants · click a count to see details
              </p>
              {perTaskBreakdown.length === 0 ? (
                <p className="muted">No tasks defined.</p>
              ) : (
                <div className="cx-taskwise-table">
                  <div className="cx-taskwise-head">
                    <span>Task</span>
                    <span>Completed</span>
                    <span>Not completed</span>
                  </div>
                  {perTaskBreakdown.map(({ task, completed, notCompleted }) => (
                    <div key={task.id} className="cx-taskwise-row">
                      <span className="cx-taskwise-name">{task.title}</span>
                      <button
                        type="button"
                        className="cx-count-btn cx-count-btn--done"
                        onClick={() =>
                          setModal({
                            title: `${task.title} — Completed (${selectedBatchLabel})`,
                            participants: completed,
                          })
                        }
                      >
                        {completed.length}
                      </button>
                      <button
                        type="button"
                        className="cx-count-btn cx-count-btn--pending"
                        onClick={() =>
                          setModal({
                            title: `${task.title} — Not completed (${selectedBatchLabel})`,
                            participants: notCompleted,
                          })
                        }
                      >
                        {notCompleted.length}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
