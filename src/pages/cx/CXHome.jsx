import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { sendTaskReminder, sendSessionReminder } from '../../services/notificationService';
import TaskTrackingBoard from '../../components/cx/TaskTrackingBoard';

function timeAgo(ts) {
  const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toMillis?.() || null;
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

// ── Session reminder modal ────────────────────────────────────
function SessionReminderModal({ batch, onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendSessionReminder(batch.id, message.trim() || undefined);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message || 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="cx-modal-backdrop" onClick={onClose}>
      <div className="cx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal__header">
          <div>
            <h3 className="cx-modal__title">Session reminder</h3>
            <p className="cx-modal__sub muted">
              {batch.name} · {(batch.memberIds || []).length} learner{(batch.memberIds || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" className="cx-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="cx-modal__body">
          {result ? (
            result.error ? (
              <div className="cx-modal-result cx-modal-result--error">
                <span className="cx-modal-result__icon">✕</span>
                <span>{result.error}</span>
              </div>
            ) : (
              <div className="cx-modal-result cx-modal-result--success">
                <span className="cx-modal-result__icon">✓</span>
                <span>
                  Sent to <strong>{result.sent}</strong> learner{result.sent !== 1 ? 's' : ''}
                  {result.skipped > 0 ? ` · ${result.skipped} without notifications enabled` : ''}
                </span>
              </div>
            )
          ) : (
            <>
              <textarea
                className="cx-review-feedback"
                rows={3}
                placeholder={`Session reminder for ${batch.name}. Check your LMS for the latest updates.`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoFocus
              />
              <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                Leave blank to use the default message.
              </p>
            </>
          )}
        </div>

        <div className="cx-modal__footer">
          {!result && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending}
              onClick={handleSend}
            >
              {sending ? 'Sending…' : 'Send reminder'}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CXHome() {
  const { profile } = useAuth();
  const { program, adapter } = useProgramAdapter();
  const { batches, users, students, tasks, submissions, loading, error, refresh } = useCxData(program, adapter);
  const navigate = useNavigate();

  const [remindingId, setRemindingId] = useState(null); // userId_taskId being reminded
  const [remindResult, setRemindResult] = useState({}); // { [userId_taskId]: 'sent'|'error'|'no_token' }
  const [sessionBatch, setSessionBatch] = useState(null); // batch open in modal

  const pendingReviews = useMemo(() => {
    const userById = new Map(students.map((s) => [s.id, s]));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    return submissions
      .filter(
        (s) =>
          s.status === SUBMISSION_STATUS.SUBMITTED || s.status === SUBMISSION_STATUS.UNDER_REVIEW
      )
      .map((s) => ({
        ...s,
        learner: userById.get(s.userId),
        task: taskById.get(s.taskId),
      }))
      .filter((s) => s.learner && s.task)
      .sort((a, b) => (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0));
  }, [submissions, students, tasks]);

  const openReview = (userId, taskId) => navigate(`/cx/review/${userId}/${taskId}`);

  const handleTaskRemind = async (userId, taskId) => {
    const key = `${userId}_${taskId}`;
    setRemindingId(key);
    try {
      const res = await sendTaskReminder(userId, taskId);
      setRemindResult((prev) => ({ ...prev, [key]: res?.sent ? 'sent' : 'no_token' }));
    } catch {
      setRemindResult((prev) => ({ ...prev, [key]: 'error' }));
    } finally {
      setRemindingId(null);
    }
  };

  const remindLabel = (key) => {
    if (remindingId === key) return 'Sending…';
    const r = remindResult[key];
    if (r === 'sent') return 'Sent ✓';
    if (r === 'no_token') return 'No token';
    if (r === 'error') return 'Failed';
    return 'Remind';
  };

  return (
    <div className="page cx-page">
      <h1>Hi, {profile?.displayName?.split(' ')[0] || 'there'}</h1>
      <p className="page-sub">{getProgramLabel(program)} · Customer Experience dashboard</p>

      {error && <p className="cx-error">{error}</p>}

      {sessionBatch && (
        <SessionReminderModal batch={sessionBatch} onClose={() => setSessionBatch(null)} />
      )}

      <section className="cx-section">
        <div className="cx-section__head">
          <h2>Batches</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="muted">
            No {adapter.shortLabel} batches yet. Create one from the{' '}
            <Link to="/cx/batches">Batch</Link> tab.
          </p>
        ) : (
          <div className="cx-batch-cards">
            {batches.map((b) => (
              <div key={b.id} className="cx-batch-card-wrap">
                <Link to={`/cx/batches/${b.id}`} className="cx-batch-card">
                  <strong>{b.name}</strong>
                  <span className="cx-batch-card__count">{(b.memberIds || []).length}</span>
                  <span className="muted">learners</span>
                </Link>
                <button
                  type="button"
                  className="btn btn-outline btn-sm cx-batch-remind-btn"
                  title="Send session reminder to all learners in this batch"
                  onClick={() => setSessionBatch(b)}
                >
                  🔔 Session reminder
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {adapter.hasTasks ? (
        <>
          <section className="cx-section">
            <div className="cx-section__head">
              <h2>Module-wise tracking</h2>
            </div>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : (
              <TaskTrackingBoard
                students={students}
                batches={batches}
                tasks={tasks}
                submissions={submissions}
                onOpenSubmission={openReview}
              />
            )}
          </section>

          <section className="cx-section">
            <div className="cx-section__head">
              <h2>Pending reviews</h2>
              {pendingReviews.length > 0 && (
                <span className="cx-count-badge">{pendingReviews.length}</span>
              )}
            </div>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : pendingReviews.length === 0 ? (
              <p className="muted">Nothing waiting on you. 🎉</p>
            ) : (
              <ul className="cx-review-list">
                {pendingReviews.map((s) => {
                  const key = `${s.userId}_${s.taskId}`;
                  const alreadySent = remindResult[key] === 'sent';
                  return (
                    <li key={s.id || key} className="cx-review-list-item">
                      <button
                        type="button"
                        className="cx-review-item"
                        onClick={() => openReview(s.userId, s.taskId)}
                      >
                        <span className="cx-review-item__who">
                          {s.learner.displayName || s.learner.email}
                        </span>
                        <span className="cx-review-item__task">{s.task.title}</span>
                        <span className="cx-review-item__age muted">
                          {timeAgo(s.submittedAt || s.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm btn-outline cx-remind-btn${remindResult[key] === 'sent' ? ' cx-remind-btn--sent' : ''}${remindResult[key] === 'error' ? ' cx-remind-btn--error' : ''}`}
                        disabled={remindingId === key || alreadySent}
                        onClick={() => handleTaskRemind(s.userId, s.taskId)}
                        title="Send push notification reminder to this learner"
                      >
                        {remindLabel(key)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="cx-section">
          <h2>Task tracking</h2>
          <p className="muted">
            Task tracking for {adapter.shortLabel} is coming soon — the journey for this program has
            not been defined yet. Batch and attendance insights are available meanwhile.
          </p>
        </section>
      )}
    </div>
  );
}
