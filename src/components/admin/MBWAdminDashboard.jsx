import { useEffect, useMemo, useState } from 'react';
import {
  PRE_SESSION_TASKS,
  SUBMISSION_STATUS,
  getAllSubmissions,
} from '../../services/mbwService';
import { getProgramLabel } from '../../data/programTypes';
import { filterStudentsForBatches } from '../../utils/batchScope';
import ErrcReadOnlyTable from '../mbw/ErrcReadOnlyTable';

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

export default function MBWAdminDashboard({
  users = [],
  batches = [],
  isScoped = false,
  onRefresh,
}) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchFilter, setBatchFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');

  const tasks = PRE_SESSION_TASKS;

  const loadSubs = async () => {
    setLoading(true);
    try {
      const subs = await getAllSubmissions();
      setSubmissions(subs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubs();
  }, []);

  const scopedBatchIds = useMemo(() => new Set(batches.map((b) => b.id)), [batches]);

  const subByUser = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      if (isScoped && s.batchId && !scopedBatchIds.has(s.batchId) && s.batchId !== 'default') {
        return;
      }
      if (!map[s.userId]) map[s.userId] = {};
      map[s.userId][s.taskId] = s;
    });
    return map;
  }, [submissions, isScoped, scopedBatchIds]);

  const batchFilterOptions = useMemo(() => {
    if (isScoped && batches.length) {
      return [{ id: 'all', name: 'All my batches' }, ...batches.map((b) => ({ id: b.id, name: b.name }))];
    }
    const fromSubs = new Set(submissions.map((s) => s.batchId || 'default'));
    const fromUsers = new Set(users.map((u) => u.batchId).filter(Boolean));
    const ids = new Set([...fromSubs, ...fromUsers]);
    return [
      { id: 'all', name: 'All batches' },
      ...[...ids].map((id) => ({
        id,
        name: batches.find((b) => b.id === id)?.name || users.find((u) => u.batchId === id)?.batchName || id,
      })),
    ];
  }, [isScoped, batches, submissions, users]);

  const filteredUsers = useMemo(() => {
    if (isScoped) {
      return filterStudentsForBatches(users, batches, batchFilter);
    }
    return users.filter((u) => {
      if (u.role && !['student', 'moderator'].includes(u.role) && u.role !== '') return false;
      if (batchFilter !== 'all') {
        const subs = subByUser[u.id];
        const matchSub = subs && Object.values(subs).some((s) => (s.batchId || 'default') === batchFilter);
        const matchProfile = u.batchId === batchFilter;
        if (!matchSub && !matchProfile) return false;
      }
      return u.role === 'student' || !u.role;
    });
  }, [users, batches, batchFilter, isScoped, subByUser]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedSubs = selectedUser ? subByUser[selectedUser.id] || {} : {};

  const completedCount = useMemo(() => {
    return filteredUsers.filter((u) => {
      const subs = subByUser[u.id];
      if (!subs) return false;
      return tasks.every((t) => subs[t.id]?.status === SUBMISSION_STATUS.COMPLETED);
    }).length;
  }, [filteredUsers, subByUser, tasks]);

  const handleRefresh = async () => {
    await loadSubs();
    onRefresh?.();
  };

  if (isScoped && batches.length === 0) {
    return (
      <section className="admin-section mbw-admin">
        <h2>My batches</h2>
        <p className="muted">
          No batches are assigned to you yet. Ask an admin to add you as the Customer Expression lead on a
          batch.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-section mbw-admin">
      <h2>{isScoped ? 'My batches — MBW tracker' : 'MBW Pre-Session Tracker'}</h2>
      <p className="mbw-admin__intro">
        {isScoped
          ? 'Your assigned batches · click a participant to view submissions and contact details.'
          : 'Batch-wise completion · click a participant to view their submissions.'}
      </p>

      {isScoped && batches.length > 0 && (
        <div className="mbw-admin__batch-cards">
          {batches.map((b) => (
            <div key={b.id} className="mbw-dash-card mbw-admin__batch-card">
              <strong>{b.name}</strong>
              <span className="muted">{getProgramLabel(b.program)}</span>
              <span>{(b.memberIds || []).length} learners</span>
            </div>
          ))}
        </div>
      )}

      <div className="mbw-admin__stats muted">
        <span>{filteredUsers.length} participants</span>
        <span> · </span>
        <span>{completedCount} completed all tasks</span>
      </div>

      <div className="admin-form mbw-admin__filters">
        <label>
          Batch{' '}
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            {batchFilterOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mbw-skeleton" aria-hidden>
          <div className="mbw-skeleton__bar" />
          <div className="mbw-skeleton__panel" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <p className="muted">No learners in this batch yet.</p>
      ) : (
        <div className="progress-table-wrap">
          <table className="progress-table mbw-admin-grid">
            <thead>
              <tr>
                <th>Participant</th>
                {tasks.map((t) => (
                  <th key={t.id} title={t.title} className="mbw-admin-th">
                    <span className="mbw-admin-th__num">{t.order + 1}</span>
                    <span className="mbw-admin-th__name">{t.title.split(' ').slice(0, 2).join(' ')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button type="button" className="mbw-admin-name" onClick={() => setSelectedUserId(u.id)}>
                      {u.displayName || u.email}
                    </button>
                    {u.phone && <span className="mbw-admin-phone">{u.phone}</span>}
                    {u.batchName && <span className="mbw-admin-phone">{u.batchName}</span>}
                  </td>
                  {tasks.map((t) => {
                    const sub = subByUser[u.id]?.[t.id];
                    const st = sub?.status || SUBMISSION_STATUS.LOCKED;
                    return (
                      <td key={t.id} className={`mbw-admin-cell ${statusCellClass(st)}`} title={t.title}>
                        {statusShort(st)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUser && (
        <div className="admin-card mbw-admin-detail">
          <div className="admin-card__head">
            <h3>{selectedUser.displayName || selectedUser.email}</h3>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedUserId('')}>
              Close
            </button>
          </div>
          <p className="mbw-admin-detail__meta">
            {selectedUser.email}
            {selectedUser.phone ? ` · ${selectedUser.phone}` : ' · No phone on profile'}
            {selectedUser.batchName ? ` · ${selectedUser.batchName}` : ''}
          </p>

          <ul className="admin-list mbw-admin-detail__list">
            {tasks.map((t) => {
              const sub = selectedSubs[t.id];
              return (
                <li key={t.id} className={!sub ? 'mbw-admin-detail__empty' : ''}>
                  <strong>
                    {t.order + 1}. {t.title}
                  </strong>{' '}
                  {sub ? (
                    <span className={`mbw-status-pill mbw-status-pill--${sub.status === 'completed' ? 'done' : 'open'}`}>
                      {sub.status}
                    </span>
                  ) : (
                    <span className="muted">Not started</span>
                  )}
                  {sub?.feedback && (
                    <p className="mbw-admin-detail__text">
                      <strong>Feedback:</strong> {sub.feedback}
                    </p>
                  )}
                  {sub?.textValue && <p className="mbw-admin-detail__text">{sub.textValue}</p>}
                  {sub?.linkValue && (
                    <p>
                      <a href={sub.linkValue} target="_blank" rel="noreferrer">
                        {sub.linkValue}
                      </a>
                    </p>
                  )}
                  {sub?.fileUrl && (
                    <p>
                      <a href={sub.fileUrl} target="_blank" rel="noreferrer">
                        {sub.fileName || 'Resume'}
                      </a>
                    </p>
                  )}
                  {sub?.videoUrl && (
                    <video src={sub.videoUrl} controls className="mbw-admin-detail__video" />
                  )}
                  {sub?.templateData?.rows && <ErrcReadOnlyTable rows={sub.templateData.rows} />}
                  {sub?.weekEntries?.length > 0 && (
                    <ul className="mbw-admin-weeks">
                      {sub.weekEntries.map((e, i) => (
                        <li key={i}>
                          {e.weekLabel}: {(e.links || [e.linkValue]).filter(Boolean).join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
