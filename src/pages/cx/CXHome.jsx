import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  X,
  Users,
  ClipboardCheck,
  RefreshCw,
  TrendingUp,
  Layers,
  ChevronRight,
  Inbox,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { useCxAttention } from '../../hooks/useCxAttention';
import { summariseReachability } from '../../utils/contactDetails';
import { studentsInBatch } from '../../utils/batchScope';
import { isLearnerActionRequired, getSubmissionReviewDisplay } from '../../utils/submissionReview';
import { sendTaskReminder, sendSessionReminder } from '../../services/notificationService';
import CxKpiStrip from '../../components/cx/CxKpiStrip';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useFocusTrap } from '../../hooks/useFocusTrap';

function timeAgo(ts) {
  const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toMillis?.() || null;
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** How many queue items the home panel previews. The KPI never uses this. */
const ATTENTION_PREVIEW_COUNT = 8;

function learnerInitial(name, email) {
  const source = (name || email || '?').trim();
  return source.charAt(0).toUpperCase();
}

function SessionReminderModal({ batch, learners = [], onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  /*
   * Who will actually receive this, worked out before it is sent rather than
   * discovered afterwards. A reminder that reaches half a batch looks identical
   * to one that reaches all of it unless somebody says so here.
   */
  const reach = useMemo(() => summariseReachability(learners), [learners]);
  const panelRef = useRef(null);
  const titleId = 'cx-session-reminder-title';

  useFocusTrap(true, panelRef, { onEscape: onClose });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
      <div
        className="cx-modal"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cx-modal__header">
          <div>
            <h3 className="cx-modal__title" id={titleId}>
              Send session reminder
            </h3>
            <p className="cx-modal__sub muted">
              {batch.name} · {(batch.memberIds || []).length} learner
              {(batch.memberIds || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" className="cx-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="cx-modal__body">
          {!result && reach.total > 0 && (
            <div
              className={`reach-note${reach.reachable < reach.total ? ' reach-note--partial' : ''}`}
            >
              <p className="reach-note__head">
                <b>
                  {reach.reachable} of {reach.total}
                </b>{' '}
                will receive this on WhatsApp
              </p>
              {reach.reachable < reach.total && (
                <ul className="reach-note__list">
                  {Object.entries(reach.byReason).map(([reason, n]) => (
                    <li key={reason}>
                      <b>{n}</b> —{' '}
                      {reason === 'no consent' ? 'has not agreed to be messaged' : reason}
                    </li>
                  ))}
                </ul>
              )}
              <p className="reach-note__foot muted">
                Everyone still gets the in-app reminder. The rest need a number or a yes before
                WhatsApp can reach them.
              </p>
            </div>
          )}
          {result ? (
            result.error ? (
              <div className="cx-modal-result cx-modal-result--error" role="alert">
                <span className="cx-modal-result__icon" aria-hidden>
                  <X size={18} />
                </span>
                <span>{result.error}</span>
              </div>
            ) : (
              <div className="cx-modal-result cx-modal-result--success" role="status">
                <span className="cx-modal-result__icon" aria-hidden>
                  <Check size={18} />
                </span>
                <span>
                  Sent to <strong>{result.sent}</strong> learner{result.sent !== 1 ? 's' : ''}
                </span>
              </div>
            )
          ) : (
            <>
              <textarea
                className="cx-review-feedback"
                rows={3}
                placeholder={`Reminder for ${batch.name}. Check the LMS for updates.`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoFocus
              />
              <p className="muted cx-modal__hint">
                Optional — leave blank for the default message.
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
  /*
   * Learners are still fetched in full — a thousand load in about a second and
   * the participant count has to stay exact. Submissions are not: at eight per
   * learner they were the whole of a sixty-second wait, and everything this
   * page shows from them is a count or eight rows.
   */
  const {
    batches,
    students,
    activeTasks,
    loading: rosterLoading,
    error,
    refresh: refreshRoster,
  } = useCxData(program, adapter, { submissions: 'none' });

  const activeTaskIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const attention = useCxAttention({
    collectionName: adapter.submissionCollection,
    enabled: adapter.hasTasks,
    activeTaskIds,
  });

  const loading = rosterLoading || attention.loading;
  const navigate = useNavigate();

  const refresh = () => {
    refreshRoster();
    attention.refresh();
  };

  const [remindingId, setRemindingId] = useState(null);
  const [remindResult, setRemindResult] = useState({});
  const [sessionBatch, setSessionBatch] = useState(null);

  /**
   * Full queue — never truncated. The KPI tile and panel badge must report the real
   * backlog; only the rendered list is capped (see ATTENTION_PREVIEW_COUNT).
   */
  const attentionItems = useMemo(() => {
    if (!adapter.hasTasks) return [];

    const userById = new Map(students.map((s) => [s.id, s]));
    const taskById = new Map(activeTasks.map((t) => [t.id, t]));

    return attention.items
      .map((s) => {
        const needsResubmit = isLearnerActionRequired(s.status);
        const display = getSubmissionReviewDisplay(s);
        return {
          ...s,
          learner: userById.get(s.userId),
          task: taskById.get(s.taskId) || {
            id: s.taskId,
            title: s.taskTitle || s.title || s.taskId || 'Submitted task',
          },
          needsResubmit,
          statusLabel: needsResubmit ? 'Waiting for resubmit' : 'Ready to review',
          statusTone: needsResubmit ? display.tone : 'review',
        };
      })
      .filter((s) => s.learner)
      .sort((a, b) => {
        const priority = Number(b.needsResubmit) - Number(a.needsResubmit);
        if (priority) return priority;
        const aMs =
          a.submittedAt?.toMillis?.() ||
          (a.submittedAt?.seconds || 0) * 1000 ||
          Date.parse(a.submittedAt || '') ||
          0;
        const bMs =
          b.submittedAt?.toMillis?.() ||
          (b.submittedAt?.seconds || 0) * 1000 ||
          Date.parse(b.submittedAt || '') ||
          0;
        return aMs - bMs;
      });
  }, [attention.items, students, activeTasks, adapter.hasTasks]);

  const visibleAttentionItems = attentionItems;
  /** The whole backlog, counted by the database — not the size of the preview. */
  const attentionTotal = attention.total ?? 0;
  const hiddenAttentionCount = Math.max(0, attentionTotal - visibleAttentionItems.length);

  /*
   * Same arithmetic as before — completed learner-task pairs over the pairs that
   * could exist. The numerator is now counted by the database per active task
   * instead of derived from every submission, which is what made this page slow.
   */
  const completionRate = useMemo(() => {
    const completed = attention.completedCells;
    const possible = students.length * activeTasks.length;
    // null, not 0 — a figure we could not obtain must not be shown as "none".
    if (completed === null || !possible) return null;
    return Math.round((Math.min(completed, possible) / possible) * 100);
  }, [attention.completedCells, students.length, activeTasks.length]);

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
    if (r === 'no_token') return 'No alert set up';
    if (r === 'error') return 'Failed';
    return 'Remind';
  };

  const firstName =
    String(profile?.displayName ?? '')
      .trim()
      .split(/\s+/)[0] || '';

  const kpiItems = [
    {
      id: 'participants',
      label: 'Participants',
      value: students.length,
      icon: Users,
    },
    ...(adapter.hasTasks
      ? [
          {
            id: 'attention',
            label: 'Needs attention',
            value: attentionTotal,
            icon: ClipboardCheck,
            tone: attentionTotal > 0 ? 'warning' : undefined,
          },
          {
            id: 'progress',
            label: 'Tasks completed',
            value: completionRate === null ? '—' : `${completionRate}%`,
            icon: TrendingUp,
          },
        ]
      : [
          {
            id: 'batches',
            label: 'Batches',
            value: batches.length,
            icon: Layers,
          },
        ]),
  ];

  return (
    <div className="page cx-page cx-home-page">
      <header className="cx-home-hero">
        <div className="cx-home-hero__text">
          <p className="cx-home-hero__eyebrow">{adapter.shortLabel} program</p>
          <h1 className="cx-home-hero__title">{firstName ? `Hi, ${firstName}` : 'Home'}</h1>
          <p className="cx-home-hero__subtitle">
            See what needs your attention, then open a batch to manage learners.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm cx-home-hero__refresh"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={14} aria-hidden />
          Refresh
        </button>
      </header>

      <CxKpiStrip items={kpiItems} loading={loading} />

      {error && (
        <p className="cx-error" role="alert">
          {error}
        </p>
      )}

      {sessionBatch && (
        <SessionReminderModal
          batch={sessionBatch}
          learners={studentsInBatch(sessionBatch, students)}
          onClose={() => setSessionBatch(null)}
        />
      )}

      <div className="cx-home-grid">
        {adapter.hasTasks && (
          <section
            className="cx-panel cx-home-panel cx-home-panel--primary"
            aria-labelledby="cx-attention-heading"
          >
            <div className="cx-panel__head">
              <h2 id="cx-attention-heading" className="cx-panel__title">
                Needs your attention
                {attentionTotal > 0 && <span className="cx-panel__count">{attentionTotal}</span>}
              </h2>
            </div>
            <div className="cx-panel__body">
              {loading ? (
                <DashboardSkeleton rows={3} />
              ) : visibleAttentionItems.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="You're all caught up"
                  message="New submissions and resubmits will show up here. Use Reviews in the menu to browse everything."
                  className="cx-home-empty-state"
                />
              ) : (
                <ul className="cx-attention-cards">
                  {visibleAttentionItems.map((s) => {
                    const key = `${s.userId}_${s.taskId}`;
                    const alreadySent = remindResult[key] === 'sent';
                    const displayName = s.learner.displayName || s.learner.email;
                    return (
                      <li key={s.id || key} className="cx-attention-card">
                        <div className="cx-attention-card__avatar" aria-hidden="true">
                          {learnerInitial(displayName, s.learner.email)}
                        </div>
                        <div className="cx-attention-card__body">
                          <div className="cx-attention-card__top">
                            <span className="cx-attention-card__who">{displayName}</span>
                            <span
                              className={`cx-attention-card__status mbw-status-pill mbw-status-pill--${s.statusTone}`}
                            >
                              {s.statusLabel}
                            </span>
                          </div>
                          <p className="cx-attention-card__task">{s.task.title}</p>
                          <p className="cx-attention-card__meta muted">
                            {timeAgo(s.submittedAt || s.updatedAt)}
                          </p>
                        </div>
                        <div className="cx-attention-card__actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openReview(s.userId, s.taskId)}
                          >
                            Review
                          </button>
                          {s.needsResubmit && (
                            <button
                              type="button"
                              className={`btn btn-outline btn-sm${remindResult[key] === 'sent' ? ' cx-remind-btn--sent' : ''}`}
                              disabled={remindingId === key || alreadySent}
                              onClick={() => handleTaskRemind(s.userId, s.taskId)}
                            >
                              {remindLabel(key)}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!loading && hiddenAttentionCount > 0 && (
                <p className="cx-panel__more muted">
                  Showing {visibleAttentionItems.length} of {attentionTotal}.{' '}
                  <Link to="/cx/reviews">
                    View all {attentionTotal} pending review
                    {attentionTotal === 1 ? '' : 's'}
                  </Link>
                </p>
              )}
            </div>
          </section>
        )}

        <aside className="cx-home-sidebar">
          <section className="cx-panel cx-home-panel" aria-labelledby="cx-batches-heading">
            <div className="cx-panel__head">
              <h2 id="cx-batches-heading" className="cx-panel__title">
                Your batches
              </h2>
              <span className="cx-panel__meta muted">{batches.length} total</span>
            </div>
            <div className="cx-panel__body">
              {loading ? (
                <DashboardSkeleton rows={2} />
              ) : batches.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No batches yet"
                  message="Go to Batches in the menu to create one and add learners."
                  className="cx-home-empty-state cx-home-empty-state--compact"
                />
              ) : (
                <ul className="cx-batch-cards-home">
                  {batches.map((b) => {
                    const count = (b.memberIds || []).length;
                    return (
                      <li key={b.id}>
                        <article className="cx-batch-card-home">
                          <Link to={`/cx/batches/${b.id}`} className="cx-batch-card-home__link">
                            <span className="cx-batch-card-home__icon" aria-hidden="true">
                              <Layers size={18} />
                            </span>
                            <span className="cx-batch-card-home__text">
                              <span className="cx-batch-card-home__name">{b.name}</span>
                              <span className="cx-batch-card-home__count">
                                {count} learner{count === 1 ? '' : 's'}
                              </span>
                            </span>
                            <ChevronRight
                              size={18}
                              className="cx-batch-card-home__chevron"
                              aria-hidden
                            />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm cx-batch-card-home__remind"
                            title="Send session reminder to this batch"
                            onClick={() => setSessionBatch(b)}
                          >
                            <Bell size={14} aria-hidden />
                            Remind
                          </button>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {!adapter.hasTasks && (
            <section className="cx-panel cx-home-panel cx-home-panel--note">
              <div className="cx-panel__body">
                <p className="muted cx-home-note">
                  Task reviews for {adapter.shortLabel} are not set up yet. You can still manage
                  batches and session recordings from the menu.
                </p>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
