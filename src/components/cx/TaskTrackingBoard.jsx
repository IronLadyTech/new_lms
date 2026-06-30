import { useMemo, useState } from 'react';
import {
  buildSubmissionIndex,
  groupTasksByModule,
  isCxSubmissionComplete,
  moduleCompletionPct,
} from '../../utils/cxMetrics';
import { filterStudentsForBatches } from '../../utils/batchScope';
import ParticipantListModal from './ParticipantListModal';
import ModuleTaskGrid from './ModuleTaskGrid';

/**
 * Participant × task status grid, grouped by program module (Pre-Prep, Q1, …).
 */
export default function TaskTrackingBoard({
  students = [],
  batches = [],
  tasks = [],
  submissions = [],
  onOpenSubmission,
}) {
  const [batchFilter, setBatchFilter] = useState('all');
  const [modal, setModal] = useState(null);

  const subByUser = useMemo(() => buildSubmissionIndex(submissions), [submissions]);

  const filteredStudents = useMemo(
    () => filterStudentsForBatches(students, batches, batchFilter),
    [students, batches, batchFilter]
  );

  const moduleGroups = useMemo(() => groupTasksByModule(tasks), [tasks]);

  const { completedStudents, notCompletedStudents } = useMemo(() => {
    const completed = filteredStudents.filter((u) =>
      tasks.every((t) => isCxSubmissionComplete(subByUser[u.id]?.[t.id], t))
    );
    const notCompleted = filteredStudents.filter(
      (u) => !tasks.every((t) => isCxSubmissionComplete(subByUser[u.id]?.[t.id], t))
    );
    return { completedStudents: completed, notCompletedStudents: notCompleted };
  }, [filteredStudents, tasks, subByUser]);

  if (!tasks.length) return null;

  return (
    <div className="cx-board">
      {modal && (
        <ParticipantListModal
          title={modal.title}
          participants={modal.participants}
          onClose={() => setModal(null)}
        />
      )}

      <div className="cx-board__toolbar">
        <div className="cx-board__counts">
          <span className="muted">{filteredStudents.length} participants</span>
          <span className="cx-board__sep">·</span>
          <button
            type="button"
            className="cx-count-btn cx-count-btn--done"
            onClick={() => setModal({ title: 'Completed all tasks', participants: completedStudents })}
          >
            {completedStudents.length} completed
          </button>
          <span className="cx-board__sep">·</span>
          <button
            type="button"
            className="cx-count-btn cx-count-btn--pending"
            onClick={() => setModal({ title: 'Not yet completed', participants: notCompletedStudents })}
          >
            {notCompletedStudents.length} not completed
          </button>
        </div>
        <label className="cx-board__filter">
          Batch{' '}
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="all">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredStudents.length === 0 ? (
        <p className="muted">No learners in this batch yet.</p>
      ) : (
        <div className="cx-module-stack">
          {moduleGroups.map((mod, i) => (
            <ModuleTaskGrid
              key={mod.id}
              module={mod}
              students={filteredStudents}
              subByUser={subByUser}
              completionPct={moduleCompletionPct(filteredStudents, mod.tasks, submissions)}
              onOpenSubmission={onOpenSubmission}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
