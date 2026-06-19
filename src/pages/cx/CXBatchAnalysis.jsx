import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { getBatchAttendanceSummary } from '../../services/attendanceService';
import { getTodayKey, addDaysToKey } from '../../utils/streakTimezone';
import ParticipantListModal from '../../components/cx/ParticipantListModal';

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

function StatCard({ value, label, variant, onClick }) {
  return (
    <div
      className={`cx-stat${onClick ? ' cx-stat--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className={`cx-stat__value${variant ? ` cx-stat__value--${variant}` : ''}`}>{value}</span>
      <span className="cx-stat__label">{label}</span>
    </div>
  );
}

export default function CXBatchAnalysis() {
  const { batchId } = useParams();
  const { program, adapter } = useProgramAdapter();
  const { batches, students, tasks, submissions, loading } = useCxData(program, adapter);
  const [modal, setModal] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const batch = batches.find((b) => b.id === batchId);

  const members = useMemo(() => {
    if (!batch) return [];
    const ids = new Set(batch.memberIds || []);
    return students.filter((s) => ids.has(s.id) || s.batchId === batchId);
  }, [batch, students, batchId]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const batchSubs = useMemo(
    () => submissions.filter((s) => memberIds.has(s.userId)),
    [submissions, memberIds]
  );

  // Activity buckets based on lastActivityAt from user profiles
  const activityStats = useMemo(() => {
    const now = Date.now();
    const ms7 = now - 7 * 86400000;
    const ms30 = now - 30 * 86400000;
    const getMs = (m) =>
      m.lastActivityAt?.seconds ? m.lastActivityAt.seconds * 1000 : m.lastActivityAt?.toMillis?.() || 0;
    return {
      active7: members.filter((m) => getMs(m) >= ms7),
      active30: members.filter((m) => getMs(m) >= ms30),
      neverActive: members.filter((m) => !m.lastActivityAt),
    };
  }, [members]);

  // Per-task breakdown with participant lists
  const perTask = useMemo(
    () =>
      tasks.map((t) => {
        const completedMembers = members.filter((m) =>
          batchSubs.some(
            (s) => s.userId === m.id && s.taskId === t.id && s.status === SUBMISSION_STATUS.COMPLETED
          )
        );
        const notCompletedMembers = members.filter(
          (m) =>
            !batchSubs.some(
              (s) => s.userId === m.id && s.taskId === t.id && s.status === SUBMISSION_STATUS.COMPLETED
            )
        );
        return { task: t, completedMembers, notCompletedMembers };
      }),
    [tasks, batchSubs, members]
  );

  // Per-learner task count, sorted descending
  const perLearner = useMemo(
    () =>
      members
        .map((m) => ({
          learner: m,
          done: batchSubs.filter(
            (s) => s.userId === m.id && s.status === SUBMISSION_STATUS.COMPLETED
          ).length,
        }))
        .sort((a, b) => b.done - a.done),
    [members, batchSubs]
  );

  // Fetch batch-level attendance when batch courseIds and members are ready
  const courseIdsKey = batch?.courseIds?.join(',') || '';
  const memberCount = members.length;
  useEffect(() => {
    if (!courseIdsKey || !memberCount) return;
    const today = getTodayKey();
    const start = addDaysToKey(today, -365);
    setAttendanceLoading(true);
    getBatchAttendanceSummary(members.map((m) => m.id), batch.courseIds, start, today)
      .then(setAttendance)
      .finally(() => setAttendanceLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, courseIdsKey, memberCount]);

  // Aggregate attendance stats for the batch
  const attendanceStats = useMemo(() => {
    const withRecords = members.filter((m) => attendance[m.id]?.total > 0);
    if (!withRecords.length) return null;
    const goodAttendance = withRecords.filter((m) => {
      const a = attendance[m.id];
      return a.total > 0 && a.present / a.total >= 0.8;
    });
    const poorAttendance = withRecords.filter((m) => {
      const a = attendance[m.id];
      return a.total > 0 && a.present / a.total < 0.6;
    });
    const avgPct = Math.round(
      withRecords.reduce((sum, m) => {
        const a = attendance[m.id];
        return sum + (a.total > 0 ? a.present / a.total : 0);
      }, 0) /
        withRecords.length *
        100
    );
    return { withRecords, goodAttendance, poorAttendance, avgPct };
  }, [attendance, members]);

  if (loading) {
    return (
      <div className="page cx-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="page cx-page">
        <h1>Batch not found</h1>
        <p className="page-sub">
          This batch does not exist or belongs to another program.{' '}
          <Link to="/cx/batches">Back to batches</Link>
        </p>
      </div>
    );
  }

  const allTasksCompletedMembers = perLearner
    .filter((p) => p.done === tasks.length && tasks.length > 0)
    .map((p) => p.learner);

  const completionRate =
    members.length && tasks.length
      ? Math.round(
          perLearner.reduce((s, p) => s + p.done, 0) / (members.length * tasks.length) * 100
        )
      : 0;

  return (
    <div className="page cx-page">
      {modal && (
        <ParticipantListModal
          title={modal.title}
          participants={modal.participants}
          onClose={() => setModal(null)}
        />
      )}

      <Link to="/cx/batches" className="back-link">
        ← All batches
      </Link>
      <h1>{batch.name}</h1>
      <p className="page-sub">
        {getProgramLabel(batch.program)} · {members.length} learners
        {batch.description ? ` · ${batch.description}` : ''}
      </p>

      {/* Summary stat cards */}
      <section className="cx-section">
        <div className="cx-stat-grid">
          <StatCard value={members.length} label="Enrolled" />
          <StatCard
            value={activityStats.active7.length}
            label="Active (7d)"
            variant={activityStats.active7.length > 0 ? 'success' : undefined}
            onClick={() => setModal({ title: 'Active last 7 days', participants: activityStats.active7 })}
          />
          <StatCard
            value={activityStats.active30.length}
            label="Active (30d)"
            variant={activityStats.active30.length > 0 ? 'success' : undefined}
            onClick={() => setModal({ title: 'Active last 30 days', participants: activityStats.active30 })}
          />
          <StatCard
            value={activityStats.neverActive.length}
            label="Never active"
            variant={activityStats.neverActive.length > 0 ? 'danger' : undefined}
            onClick={() => setModal({ title: 'Never active', participants: activityStats.neverActive })}
          />
          {adapter.hasTasks && (
            <>
              <StatCard
                value={allTasksCompletedMembers.length}
                label="All tasks done"
                variant={allTasksCompletedMembers.length > 0 ? 'success' : undefined}
                onClick={() => setModal({ title: 'Completed all tasks', participants: allTasksCompletedMembers })}
              />
              <StatCard value={`${completionRate}%`} label="Completion rate" />
            </>
          )}
        </div>
      </section>

      {/* Attendance section — only when batch has linked courses */}
      {batch.courseIds?.length > 0 && (
        <section className="cx-section">
          <h2>Attendance</h2>
          {attendanceLoading ? (
            <p className="muted">Loading attendance…</p>
          ) : !attendanceStats ? (
            <p className="muted">No attendance records for this batch yet.</p>
          ) : (
            <div className="cx-stat-grid">
              <StatCard
                value={attendanceStats.avgPct != null ? `${attendanceStats.avgPct}%` : '—'}
                label="Avg attendance"
              />
              <StatCard
                value={attendanceStats.withRecords.length}
                label="Have records"
                onClick={() =>
                  setModal({ title: 'Members with attendance records', participants: attendanceStats.withRecords })
                }
              />
              <StatCard
                value={attendanceStats.goodAttendance.length}
                label="Good (≥80%)"
                variant={attendanceStats.goodAttendance.length > 0 ? 'success' : undefined}
                onClick={() =>
                  setModal({ title: 'Good attendance (≥80%)', participants: attendanceStats.goodAttendance })
                }
              />
              <StatCard
                value={attendanceStats.poorAttendance.length}
                label="At risk (<60%)"
                variant={attendanceStats.poorAttendance.length > 0 ? 'danger' : undefined}
                onClick={() =>
                  setModal({ title: 'At-risk attendance (<60%)', participants: attendanceStats.poorAttendance })
                }
              />
            </div>
          )}
        </section>
      )}

      {/* Task completion per task with clickable counts */}
      {adapter.hasTasks && (
        <section className="cx-section">
          <h2>Completion per task</h2>
          {perTask.length === 0 ? (
            <p className="muted">No tasks defined.</p>
          ) : (
            perTask.map(({ task, completedMembers, notCompletedMembers }) => {
              const pct = members.length
                ? Math.round((completedMembers.length / members.length) * 100)
                : 0;
              return (
                <div key={task.id} className="cx-bar">
                  <div className="cx-bar__head">
                    <span className="cx-bar__label">{task.title}</span>
                    <div className="cx-bar__actions">
                      <button
                        type="button"
                        className="cx-count-btn cx-count-btn--done"
                        onClick={() =>
                          setModal({ title: `${task.title} — Completed`, participants: completedMembers })
                        }
                      >
                        {completedMembers.length} done
                      </button>
                      <span className="cx-board__sep">·</span>
                      <button
                        type="button"
                        className="cx-count-btn cx-count-btn--pending"
                        onClick={() =>
                          setModal({ title: `${task.title} — Not completed`, participants: notCompletedMembers })
                        }
                      >
                        {notCompletedMembers.length} pending
                      </button>
                    </div>
                  </div>
                  <div className="cx-bar__track">
                    <div className="cx-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Learner table */}
      <section className="cx-section">
        <h2>Learners</h2>
        {members.length === 0 ? (
          <p className="muted">No learners in this batch yet.</p>
        ) : (
          <div className="cx-learner-table-wrap">
            <table className="cx-learner-table">
              <thead>
                <tr>
                  <th>Name / Phone</th>
                  <th>Last active</th>
                  {adapter.hasTasks && <th>Tasks</th>}
                  {attendanceStats && <th>Attendance</th>}
                </tr>
              </thead>
              <tbody>
                {perLearner.map(({ learner, done }) => {
                  const att = attendance[learner.id];
                  const attPct = att?.total > 0 ? Math.round((att.present / att.total) * 100) : null;
                  return (
                    <tr key={learner.id}>
                      <td>
                        <span className="cx-learner-name">{learner.displayName || learner.email}</span>
                        <span className="cx-learner-sub">
                          {learner.phone || learner.email}
                        </span>
                      </td>
                      <td className="cx-learner-meta">{timeAgo(learner.lastActivityAt)}</td>
                      {adapter.hasTasks && (
                        <td>
                          <span
                            className={
                              done === tasks.length && tasks.length > 0
                                ? 'cx-badge cx-badge--done'
                                : 'cx-learner-meta'
                            }
                          >
                            {done}/{tasks.length}
                          </span>
                        </td>
                      )}
                      {attendanceStats && (
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
        )}
        {!adapter.hasTasks && members.length > 0 && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Task analytics for {adapter.shortLabel} will appear once its journey is defined.
          </p>
        )}
      </section>
    </div>
  );
}
