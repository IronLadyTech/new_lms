import { useMemo, useState } from 'react';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { filterStudentsForBatches } from '../../utils/batchScope';
import ParticipantListModal from './ParticipantListModal';

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

/**
 * Program-blind participant × task status grid.
 * Receives tasks/submissions from a program adapter — it never queries on its own.
 */
export default function TaskTrackingBoard({ students = [], batches = [], tasks = [], submissions = [], onOpenSubmission }) {
  const [batchFilter, setBatchFilter] = useState('all');
  const [modal, setModal] = useState(null); // { title, participants }

  const subByUser = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      if (!map[s.userId]) map[s.userId] = {};
      map[s.userId][s.taskId] = s;
    });
    return map;
  }, [submissions]);

  const filteredStudents = useMemo(
    () => filterStudentsForBatches(students, batches, batchFilter),
    [students, batches, batchFilter]
  );

  const { completedStudents, notCompletedStudents } = useMemo(() => {
    const completed = filteredStudents.filter((u) => {
      const subs = subByUser[u.id];
      if (!subs) return false;
      return tasks.every((t) => subs[t.id]?.status === SUBMISSION_STATUS.COMPLETED);
    });
    const notCompleted = filteredStudents.filter((u) => {
      const subs = subByUser[u.id];
      if (!subs) return true;
      return !tasks.every((t) => subs[t.id]?.status === SUBMISSION_STATUS.COMPLETED);
    });
    return { completedStudents: completed, notCompletedStudents: notCompleted };
  }, [filteredStudents, subByUser, tasks]);

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
        <div className="progress-table-wrap">
          <table className="progress-table mbw-admin-grid">
            <thead>
              <tr>
                <th>Participant</th>
                {tasks.map((t, i) => (
                  <th key={t.id} title={t.title} className="mbw-admin-th">
                    <span className="mbw-admin-th__num">{(t.order ?? i) + 1}</span>
                    <span className="mbw-admin-th__name">{t.title.split(' ').slice(0, 2).join(' ')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="mbw-admin-name">{u.displayName || u.email}</span>
                    {u.batchName && <span className="mbw-admin-phone">{u.batchName}</span>}
                  </td>
                  {tasks.map((t) => {
                    const sub = subByUser[u.id]?.[t.id];
                    const st = sub?.status || SUBMISSION_STATUS.LOCKED;
                    const clickable = sub && onOpenSubmission;
                    return (
                      <td key={t.id} className={`mbw-admin-cell ${statusCellClass(st)}`} title={t.title}>
                        {clickable ? (
                          <button
                            type="button"
                            className="cx-cell-btn"
                            onClick={() => onOpenSubmission(u.id, t.id)}
                          >
                            {statusShort(st)}
                          </button>
                        ) : (
                          statusShort(st)
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
