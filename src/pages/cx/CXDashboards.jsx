import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { filterStudentsForBatches, studentsInBatch, countBatchAssignedLearners } from '../../utils/batchScope';
import {
  buildSubmissionIndex,
  buildModuleTaskBreakdown,
  countCompletedCells,
  isCxSubmissionComplete,
} from '../../utils/cxMetrics';
import ParticipantListModal from '../../components/cx/ParticipantListModal';
import CxCharts from '../../components/cx/CxCharts';

export default function CXDashboards() {
  const { program, adapter } = useProgramAdapter();
  const { batches, users, students, tasks, submissions, loading, error } = useCxData(program, adapter);
  const [modal, setModal] = useState(null);
  const [taskBatchFilter, setTaskBatchFilter] = useState('all');

  const assignedLearnerCount = useMemo(
    () => countBatchAssignedLearners(students, batches, users),
    [students, batches, users]
  );
  const unassignedLearnerCount = Math.max(0, students.length - assignedLearnerCount);

  const stats = useMemo(() => {
    const pending = submissions.filter((s) =>
      [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(s.status)
    ).length;
    const completedCells = countCompletedCells(students, tasks, submissions);
    const possible = students.length * tasks.length;
    return {
      completed: completedCells,
      pending,
      completionRate: possible ? Math.round((completedCells / possible) * 100) : 0,
    };
  }, [submissions, students, tasks]);

  const perBatch = useMemo(
    () =>
      batches.map((b) => {
        const batchLearners = studentsInBatch(b, users);
        const batchSubs = submissions.filter((s) =>
          batchLearners.some((learner) => learner.id === s.userId)
        );
        const done = countCompletedCells(batchLearners, tasks, batchSubs);
        const possible = batchLearners.length * tasks.length;
        return {
          batch: b,
          learners: batchLearners.length,
          pct: possible ? Math.round((done / possible) * 100) : 0,
        };
      }),
    [batches, submissions, tasks, users]
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

  const perModuleBreakdown = useMemo(
    () => buildModuleTaskBreakdown(taskWiseStudents, tasks, submissions),
    [tasks, taskWiseStudents, submissions]
  );

  const chartData = useMemo(() => {
    const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const possible = students.length * tasks.length;
    const completed = stats.completed;
    const awaiting = submissions.filter(
      (s) =>
        [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(s.status) &&
        !isCxSubmissionComplete(s, taskById[s.taskId])
    ).length;
    const notSubmitted = Math.max(0, possible - completed - awaiting);
    return {
      statusData: [
        { name: 'Done', value: completed },
        { name: 'Waiting for review', value: awaiting },
        { name: 'Not started', value: notSubmitted },
      ],
      batchData: perBatch.map(({ batch, pct }) => ({ name: batch.name, pct })),
    };
  }, [tasks, students, submissions, stats, perBatch]);

  return (
    <div className="page cx-page">
      <h1>Overview</h1>
      <p className="page-sub">{getProgramLabel(program)} · how your learners are progressing</p>

      {error && <p className="cx-error">{error}</p>}

      {!loading && students.length > 0 && unassignedLearnerCount > 0 && (
        <p className="cx-hint muted">
          {assignedLearnerCount} learner{assignedLearnerCount === 1 ? '' : 's'} assigned to batches ·{' '}
          {unassignedLearnerCount} on {getProgramLabel(program)} but not in a batch yet (assign via Admin →
          Batches to fix batch comparison counts).
        </p>
      )}

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
                    <span className="cx-stat__label">Tasks done</span>
                  </div>
                  <div className="cx-stat">
                    <span className="cx-stat__value">{stats.pending}</span>
                    <span className="cx-stat__label">Waiting for review</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {adapter.hasTasks && (
            <section className="cx-section">
              <div className="cx-section__head">
                <h2>How your learners are doing</h2>
              </div>
              <p className="cx-analytics-summary">
                Across <strong>{students.length}</strong> learner
                {students.length === 1 ? '' : 's'}, <strong>{stats.completionRate}%</strong> of all
                tasks are done.{' '}
                {stats.pending > 0 ? (
                  <>
                    <strong>{stats.pending}</strong> task{stats.pending === 1 ? '' : 's'} waiting for
                    your review.
                  </>
                ) : (
                  'Nothing is waiting for your review right now.'
                )}
              </p>
              <CxCharts
                statusData={chartData.statusData}
                batchData={chartData.batchData}
                donutPct={stats.completionRate}
              />
            </section>
          )}

          <section className="cx-section">
            <h2>Batches at a glance</h2>
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
                <h2>Task-by-task progress</h2>
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
              {perModuleBreakdown.length === 0 ? (
                <p className="muted">No tasks defined.</p>
              ) : (
                <div className="cx-module-stack">
                  {perModuleBreakdown.map((mod) => (
                    <div key={mod.id} className="cx-module cx-module--open cx-module--static">
                      <div className="cx-module__head cx-module__head--static">
                        <div className="cx-module__titles">
                          <span className="cx-module__title">{mod.title}</span>
                          {mod.subtitle && (
                            <span className="cx-module__subtitle muted">{mod.subtitle}</span>
                          )}
                        </div>
                        <div className="cx-module__meta">
                          <span className="cx-module__count">{mod.tasks.length} tasks</span>
                          <span className="cx-module__pct">{mod.completionPct}% done</span>
                        </div>
                      </div>
                      <div className="cx-module__body">
                        <div className="cx-taskwise-table">
                          <div className="cx-taskwise-head">
                            <span>Task</span>
                            <span>Completed</span>
                            <span>Not completed</span>
                          </div>
                          {mod.taskRows.map(({ task, completed, notCompleted }) => (
                            <div key={task.id} className="cx-taskwise-row">
                              <button
                                type="button"
                                className="cx-taskwise-name cx-taskwise-name--btn"
                                title="See who hasn't completed this yet"
                                onClick={() =>
                                  setModal({
                                    title: `${mod.title} · ${task.title} — Not completed (${selectedBatchLabel})`,
                                    participants: notCompleted,
                                  })
                                }
                              >
                                {task.title}
                              </button>
                              <button
                                type="button"
                                className="cx-count-btn cx-count-btn--done"
                                onClick={() =>
                                  setModal({
                                    title: `${mod.title} · ${task.title} — Completed (${selectedBatchLabel})`,
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
                                    title: `${mod.title} · ${task.title} — Not completed (${selectedBatchLabel})`,
                                    participants: notCompleted,
                                  })
                                }
                              >
                                {notCompleted.length}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
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
