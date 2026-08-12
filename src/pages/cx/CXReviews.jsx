import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { useCxReviewQueue, PAGE_SIZE as QUEUE_PAGE_SIZE } from '../../hooks/useCxReviewQueue';
import { getProgramLabel } from '../../data/programTypes';
import { isLearnerActionRequired, getSubmissionReviewDisplay } from '../../utils/submissionReview';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { sendTaskReminder } from '../../services/notificationService';
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

export default function CXReviews() {
  const { program, adapter } = useProgramAdapter();
  /*
   * Only the batch list and the task catalogue come from here — both are small
   * and fixed. The queue itself is read a page at a time below, so this screen
   * no longer pulls the programme's learners or submission history.
   */
  const {
    batches,
    tasks,
    loading: refLoading,
    error: refError,
    refresh: refreshRefs,
  } = useCxData(program, adapter, { submissions: 'none', users: 'none' });
  const navigate = useNavigate();

  const [remindingId, setRemindingId] = useState(null);
  const [remindResult, setRemindResult] = useState({});
  const [batchFilter, setBatchFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');

  const {
    rows,
    learners,
    counts,
    totalForFilter,
    loading: queueLoading,
    loadingMore,
    error: queueError,
    done,
    loadMore,
    refresh: refreshQueue,
  } = useCxReviewQueue({
    collectionName: adapter.submissionCollection,
    queueFilter,
    batchId: batchFilter,
  });

  const loading = refLoading || queueLoading;
  const error = queueError || refError;

  const refresh = () => {
    refreshRefs();
    refreshQueue();
  };

  /*
   * The page arrives newest-activity-first from the database. Within it the
   * original priority order still applies: work handed back to the learner
   * first, then work waiting on a reviewer, then by recency.
   */
  const visibleSubmissions = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    return rows
      .map((s) => ({
        ...s,
        learner: learners[s.userId],
        task: resolveTask(taskById, s),
      }))
      .filter((s) => s.learner)
      .sort((a, b) => {
        const actionDelta =
          Number(isLearnerActionRequired(b.status)) - Number(isLearnerActionRequired(a.status));
        if (actionDelta) return actionDelta;
        const pendingDelta =
          Number([SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(b.status)) -
          Number([SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW].includes(a.status));
        if (pendingDelta) return pendingDelta;
        return (
          submittedMs(b.submittedAt || b.updatedAt) - submittedMs(a.submittedAt || a.updatedAt)
        );
      });
  }, [rows, learners, tasks]);

  const reviewSubmissions = visibleSubmissions;
  const actionRequiredCount = counts.action;
  const pendingReviewCount = counts.pending;

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
        : counts.all > 0
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
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={refresh}
            disabled={loading}
          >
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
          {/* The whole queue, not the page currently loaded. */}
          {totalForFilter > 0 && <span className="cx-count-badge">{totalForFilter}</span>}
        </div>
        <div className="cx-panel__body">
          <div className="cx-reviews-toolbar">
            <div
              className="cx-tab-bar cx-tab-bar--inline mobile-scroll-row"
              role="tablist"
              aria-label="Queue filter"
            >
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
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing in this queue"
              message={emptyMessage}
            />
          ) : (
            <ul className="cx-review-list">
              {visibleSubmissions.map((s) => {
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

          {!loading && !done && (
            <div className="cx-review-list__more">
              <p className="muted" aria-live="polite">
                Showing {visibleSubmissions.length}
                {totalForFilter === null ? '' : ` of ${totalForFilter}`} submissions
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : `Show ${QUEUE_PAGE_SIZE} more`}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
