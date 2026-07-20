import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { isLearnerActionRequired, getSubmissionReviewDisplay } from '../../utils/submissionReview';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { sendTaskReminder } from '../../services/notificationService';
import { studentsInBatch } from '../../utils/batchScope';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

const QUEUE_FILTERS = [
  { id: 'all', label: 'All submissions' },
  { id: 'pending', label: 'Needs review' },
  { id: 'action', label: 'Awaiting resubmit' },
];

function submittedMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function timeAgo(ts) {
  const ms = submittedMs(ts);
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function resolveTask(taskById, submission) {
  const fromCatalog = taskById.get(submission.taskId);
  if (fromCatalog) return fromCatalog;
  return {
    id: submission.taskId,
    title: submission.taskTitle || submission.title || submission.taskId || 'Submitted task',
  };
}

function isVisibleCxSubmission(status) {
  return [
    SUBMISSION_STATUS.SUBMITTED,
    SUBMISSION_STATUS.UNDER_REVIEW,
    SUBMISSION_STATUS.COMPLETED,
    SUBMISSION_STATUS.NEEDS_IMPROVEMENT,
    SUBMISSION_STATUS.REJECTED,
  ].includes(status);
}

function matchesQueueFilter(submission, filterId) {
  if (filterId === 'pending') {
    return [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(submission.status);
  }
  if (filterId === 'action') {
    return isLearnerActionRequired(submission.status);
  }
  return isVisibleCxSubmission(submission.status);
}

export default function CXReviews() {
  const { program, adapter } = useProgramAdapter();
  const { batches, users, students, tasks, submissions, loading, error, refresh } = useCxData(
    program,
    adapter
  );
  const navigate = useNavigate();

  const [remindingId, setRemindingId] = useState(null);
  const [remindResult, setRemindResult] = useState({});
  const [batchFilter, setBatchFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');

  const batchMemberIds = useMemo(() => {
    if (batchFilter === 'all') return null;
    const batch = batches.find((b) => b.id === batchFilter);
    if (!batch) return new Set();
    return new Set(studentsInBatch(batch, users).map((m) => m.id));
  }, [batchFilter, batches, users]);

  const reviewSubmissions = useMemo(() => {
    const userById = new Map(students.map((s) => [s.id, s]));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    return submissions
      .filter((s) => matchesQueueFilter(s, queueFilter))
      .map((s) => ({
        ...s,
        learner: userById.get(s.userId),
        task: resolveTask(taskById, s),
      }))
      .filter((s) => s.learner)
      .filter((s) => !batchMemberIds || batchMemberIds.has(s.userId))
      .sort((a, b) => {
        const actionDelta =
          Number(isLearnerActionRequired(b.status)) - Number(isLearnerActionRequired(a.status));
        if (actionDelta) return actionDelta;
        const pendingDelta =
          Number([SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(b.status)) -
          Number([SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(a.status));
        if (pendingDelta) return pendingDelta;
        return submittedMs(b.submittedAt || b.updatedAt) - submittedMs(a.submittedAt || a.updatedAt);
      });
  }, [submissions, students, tasks, batchFilter, batchMemberIds, queueFilter]);

  const actionRequiredCount = useMemo(
    () =>
      submissions.filter((s) => isLearnerActionRequired(s.status) && isVisibleCxSubmission(s.status))
        .length,
    [submissions]
  );

  const pendingReviewCount = useMemo(
    () =>
      submissions.filter((s) =>
        [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(s.status)
      ).length,
    [submissions]
  );

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
    if (r === 'sent') return 'Sent';
    if (r === 'no_token') return 'No token';
    if (r === 'error') return 'Failed';
    return 'Remind';
  };

  if (!adapter.hasTasks) {
    return (
      <div className="page cx-page">
        <PageHeader
          eyebrow={getProgramLabel(program)}
          title="Reviews"
          subtitle="Task review for this program is not available yet."
          icon={ClipboardCheck}
        />
        <EmptyState
          icon={ClipboardCheck}
          title="No review queue"
          message={`${adapter.shortLabel} does not have task submissions to review yet.`}
        />
      </div>
    );
  }

  const emptyMessage = error
    ? 'Could not load submissions. Refresh after deploying the latest Firestore rules.'
    : queueFilter === 'pending'
      ? 'No submissions waiting for review right now.'
      : queueFilter === 'action'
        ? 'No learners are waiting to resubmit after your feedback.'
        : submissions.length > 0
          ? 'No submissions match this filter.'
          : 'When learners submit tasks, they appear here.';

  return (
    <div className="page cx-page">
      <PageHeader
        eyebrow={getProgramLabel(program)}
        title="Reviews"
        subtitle="Filter by batch or status, open a submission, and send feedback when improvement is needed."
        icon={ClipboardCheck}
        actions={
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {error && (
        <p className="cx-error" role="alert">
          {error}
        </p>
      )}

      <section className="cx-panel">
        <div className="cx-panel__head">
          <h2 className="cx-panel__title">Submission queue</h2>
          {reviewSubmissions.length > 0 && (
            <span className="cx-count-badge">{reviewSubmissions.length}</span>
          )}
        </div>
        <div className="cx-panel__body">
          <div className="cx-reviews-toolbar">
            <div className="cx-tab-bar cx-tab-bar--inline mobile-scroll-row" role="tablist" aria-label="Queue filter">
              {QUEUE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={queueFilter === f.id}
                  className={`cx-tab-bar__tab${queueFilter === f.id ? ' is-active' : ''}`}
                  onClick={() => setQueueFilter(f.id)}
                >
                  {f.label}
                  {f.id === 'action' && actionRequiredCount > 0 && (
                    <span className="cx-tab-bar__badge">{actionRequiredCount}</span>
                  )}
                  {f.id === 'pending' && pendingReviewCount > 0 && (
                    <span className="cx-tab-bar__badge">{pendingReviewCount}</span>
                  )}
                </button>
              ))}
            </div>

            {batches.length > 0 && (
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
            )}
          </div>

          {loading ? (
            <DashboardSkeleton rows={4} />
          ) : reviewSubmissions.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing in this queue" message={emptyMessage} />
          ) : (
            <ul className="cx-review-list">
              {reviewSubmissions.map((s) => {
                const key = `${s.userId}_${s.taskId}`;
                const alreadySent = remindResult[key] === 'sent';
                const display = getSubmissionReviewDisplay(s);
                const actionRequired = isLearnerActionRequired(s.status);
                const batchName =
                  batches.find((b) => b.id === s.learner.batchId)?.name || s.learner.batchName;
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
                      <span className="cx-review-item__meta muted">
                        {batchName ? `${batchName} · ` : ''}
                        {timeAgo(s.submittedAt || s.updatedAt)}
                      </span>
                      <span className={`mbw-status-pill mbw-status-pill--${display.tone}`}>
                        {display.label}
                      </span>
                    </button>
                    {actionRequired && (
                      <button
                        type="button"
                        className={`btn btn-sm btn-outline cx-remind-btn${remindResult[key] === 'sent' ? ' cx-remind-btn--sent' : ''}${remindResult[key] === 'error' ? ' cx-remind-btn--error' : ''}`}
                        disabled={remindingId === key || alreadySent}
                        onClick={() => handleTaskRemind(s.userId, s.taskId)}
                        title="Send push notification reminder to this learner"
                      >
                        {remindLabel(key)}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
