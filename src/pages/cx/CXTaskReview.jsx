import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { SUBMISSION_STATUS } from '../../services/mbwService';
import { getUserProfile } from '../../services/userService';
import SubmissionReviewView from '../../components/cx/SubmissionReviewView';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import {
  REVIEW_OUTCOME,
  getReviewOutcomeMeta,
  getSubmissionReviewDisplay,
  formatReviewedAt,
  statusForReviewOutcome,
} from '../../utils/submissionReview';
import { sendReviewNotification } from '../../services/notificationService';

const OUTCOME_OPTIONS = [
  {
    id: REVIEW_OUTCOME.APPROVED,
    label: 'Approved',
    description: 'Mark complete — learner can move on.',
    icon: CheckCircle,
    variant: 'primary',
  },
  {
    id: REVIEW_OUTCOME.NEEDS_IMPROVEMENT,
    label: 'Needs improvement',
    description: 'Learner can revise and resubmit.',
    icon: AlertTriangle,
    variant: 'outline',
  },
  {
    id: REVIEW_OUTCOME.REJECTED,
    label: 'Rejected',
    description: 'Submission did not meet requirements — learner must redo.',
    icon: XCircle,
    variant: 'outline',
  },
];

export default function CXTaskReview() {
  const { userId, taskId } = useParams();
  const { user } = useAuth();
  const { program, adapter } = useProgramAdapter();
  const navigate = useNavigate();

  const [learner, setLearner] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [outcome, setOutcome] = useState(REVIEW_OUTCOME.APPROVED);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSaved(false);
      try {
        const [profile, taskList, sub] = await Promise.all([
          getUserProfile(userId),
          adapter.getTasks(),
          adapter.getSubmission(userId, taskId),
        ]);
        if (cancelled) return;
        setLearner(profile);
        setTasks(taskList);
        setSubmission(sub);
        setFeedback(sub?.feedback || '');
        setOutcome(sub?.reviewOutcome || REVIEW_OUTCOME.APPROVED);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load submission');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, taskId, adapter]);

  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId]);
  const reviewDisplay = getSubmissionReviewDisplay(submission);
  const hasSubmission = Boolean(
    submission &&
    submission.status !== SUBMISSION_STATUS.LOCKED &&
    submission.status !== SUBMISSION_STATUS.UNLOCKED
  );

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!submission) return;

    if (
      (outcome === REVIEW_OUTCOME.NEEDS_IMPROVEMENT || outcome === REVIEW_OUTCOME.REJECTED) &&
      !feedback.trim()
    ) {
      setError('Add feedback so the learner knows what to improve.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const subId = adapter.submissionDocId(userId, taskId);
      await adapter.reviewSubmission(subId, {
        outcome,
        feedback: feedback.trim(),
        reviewerId: user?.uid,
      });
      setSaved(true);
      setSavedOutcome(outcome);
      setSubmission((prev) => ({
        ...prev,
        status: statusForReviewOutcome(outcome),
        reviewOutcome: outcome,
        feedback: feedback.trim(),
        reviewedAt: new Date(),
        reviewHistory: [
          ...(Array.isArray(prev?.reviewHistory) ? prev.reviewHistory : []),
          {
            outcome,
            feedback: feedback.trim(),
            reviewedBy: user?.uid,
            reviewedAt: new Date().toISOString(),
          },
        ],
      }));
      try {
        if (outcome === REVIEW_OUTCOME.NEEDS_IMPROVEMENT || outcome === REVIEW_OUTCOME.REJECTED) {
          await sendReviewNotification({
            userId,
            taskId,
            taskTitle: task?.title,
            outcome,
            feedback: feedback.trim(),
          });
        }
      } catch (notifyErr) {
        console.warn('Review saved but notification failed', notifyErr);
      }
    } catch (err) {
      setError(err.message || 'Could not save review');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page cx-page">
        <DashboardSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="page cx-page cx-review-page">
      <Link to="/cx/reviews" className="back-link">
        ← Back to reviews
      </Link>

      <header className="cx-review-page__header">
        <div>
          <p className="cx-review-page__eyebrow muted">{task?.week || 'Task review'}</p>
          <h1>{task?.title || 'Task review'}</h1>
          <p className="page-sub">
            {learner ? learner.displayName || learner.email : userId}
            {learner?.batchName ? ` · ${learner.batchName}` : ''}
          </p>
        </div>
        {submission && (
          <span className={`mbw-status-pill mbw-status-pill--${reviewDisplay.tone}`}>
            {reviewDisplay.label}
          </span>
        )}
      </header>

      {error && (
        <p className="cx-error" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <div className="alert alert-success cx-review-page__saved" role="status">
          {savedOutcome === REVIEW_OUTCOME.APPROVED
            ? 'Review saved. The learner can continue to the next task.'
            : 'Review saved. The learner will be notified to revise and resubmit.'}
        </div>
      )}

      {!hasSubmission ? (
        <section className="cx-section">
          <p className="muted">This participant has not submitted this task yet.</p>
        </section>
      ) : (
        <>
          <section className="cx-section">
            <h2>Submission</h2>
            <SubmissionReviewView submission={submission} task={task} />
          </section>

          <section className="cx-section cx-review-form">
            <h2>Your review</h2>
            {submission.reviewedAt && (
              <p className="muted cx-review-form__prev">
                Last reviewed {formatReviewedAt(submission.reviewedAt)}
                {submission.reviewOutcome && (
                  <> · {getReviewOutcomeMeta(submission.reviewOutcome)?.label}</>
                )}
              </p>
            )}

            <form onSubmit={handleSaveReview}>
              <fieldset className="cx-review-outcomes">
                <legend className="cx-review-outcomes__legend">Review status</legend>
                {OUTCOME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = outcome === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`cx-review-outcome${selected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="review-outcome"
                        value={opt.id}
                        checked={selected}
                        onChange={() => setOutcome(opt.id)}
                      />
                      <span className="cx-review-outcome__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="cx-review-outcome__text">
                        <strong>{opt.label}</strong>
                        <span className="muted">{opt.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <label className="field cx-review-form__feedback">
                <span className="field__label">Feedback for the learner</span>
                <textarea
                  className="cx-review-feedback"
                  rows={5}
                  placeholder="Share specific, actionable feedback. Required for Needs improvement and Rejected."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  aria-required={
                    outcome === REVIEW_OUTCOME.NEEDS_IMPROVEMENT ||
                    outcome === REVIEW_OUTCOME.REJECTED
                  }
                />
              </label>

              <div className="cx-review-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save review'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={saving}
                  onClick={() => navigate('/cx/reviews')}
                >
                  Back to queue
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
