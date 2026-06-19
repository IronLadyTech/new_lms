import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import {
  getSubmission,
  reviewSubmission,
  submissionDocId,
  SUBMISSION_STATUS,
} from '../../services/mbwService';
import { getUserProfile } from '../../services/userService';
import { sendTaskReminder } from '../../services/notificationService';
import ErrcReadOnlyTable from '../../components/mbw/ErrcReadOnlyTable';

export default function CXTaskReview() {
  const { userId, taskId } = useParams();
  const { user } = useAuth();
  const { adapter } = useProgramAdapter();
  const navigate = useNavigate();

  const [learner, setLearner] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [profile, taskList, sub] = await Promise.all([
          getUserProfile(userId),
          adapter.getTasks(),
          getSubmission(userId, taskId),
        ]);
        if (cancelled) return;
        setLearner(profile);
        setTasks(taskList);
        setSubmission(sub);
        setFeedback(sub?.feedback || '');
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

  const handleReview = async (approved) => {
    setSaving(true);
    setError('');
    try {
      await reviewSubmission(submissionDocId(userId, taskId), {
        approved,
        feedback: feedback.trim(),
        reviewerId: user?.uid,
      });
      navigate('/cx/home', { replace: true });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not save review');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page cx-page">
        <p className="muted">Loading submission…</p>
      </div>
    );
  }

  return (
    <div className="page cx-page">
      <Link to="/cx/home" className="back-link">
        ← Back to home
      </Link>
      <h1>{task?.title || 'Task review'}</h1>
      <p className="page-sub">
        {learner ? learner.displayName || learner.email : userId}
        {learner?.batchName ? ` · ${learner.batchName}` : ''}
      </p>

      {error && <p className="cx-error">{error}</p>}

      {!submission ? (
        <p className="muted">No submission found for this task.</p>
      ) : (
        <>
          <section className="cx-section">
            <h2>Submission</h2>
            <p className="muted">
              Status: <strong>{submission.status}</strong>
            </p>
            {submission.textValue && <p className="cx-review-text">{submission.textValue}</p>}
            {submission.linkValue && (
              <p>
                <a href={submission.linkValue} target="_blank" rel="noreferrer">
                  {submission.linkValue}
                </a>
              </p>
            )}
            {submission.fileUrl && (
              <p>
                <a href={submission.fileUrl} target="_blank" rel="noreferrer">
                  {submission.fileName || 'Attached file'}
                </a>
              </p>
            )}
            {submission.videoUrl && (
              <video src={submission.videoUrl} controls className="cx-review-video" />
            )}
            {submission.templateData?.rows && (
              <ErrcReadOnlyTable rows={submission.templateData.rows} />
            )}
            {submission.weekEntries?.length > 0 && (
              <ul className="cx-batch-list">
                {submission.weekEntries.map((e, i) => (
                  <li key={i} className="cx-batch-row cx-batch-row--static">
                    <span className="cx-batch-row__name">{e.weekLabel}</span>
                    <span className="cx-batch-row__count">
                      {(e.links || [e.linkValue]).filter(Boolean).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cx-section">
            <h2>Review</h2>
            <textarea
              className="cx-review-feedback"
              rows={4}
              placeholder="Feedback for the learner (optional on approve, recommended on changes)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <div className="cx-review-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || submission.status === SUBMISSION_STATUS.COMPLETED}
                onClick={() => handleReview(true)}
              >
                {saving ? 'Saving…' : 'Approve'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => handleReview(false)}
              >
                Request changes
              </button>
            </div>
            {submission.status === SUBMISSION_STATUS.COMPLETED && (
              <p className="muted">This task is already approved.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
