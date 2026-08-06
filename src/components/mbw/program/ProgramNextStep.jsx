import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { taskTypeIcon } from './taskTypeIcons';
import { getWeekCode } from '../../../utils/mbwDisplay';
import { isLearnerActionRequired } from '../../../utils/submissionReview';

/**
 * The learner's single next action — the primary surface of the program page.
 *
 * The full outline sits behind a disclosure below this, so the page opens on
 * "what do I do now" rather than on a 26-row hierarchy. One primary CTA only.
 */
export default function ProgramNextStep({
  nextTaskState,
  phaseTitle,
  completedMilestones,
  totalMilestones,
  blockedMessage,
  blockedCta,
  getDurationHint,
  getTypeIcon,
  continueLabel = 'Continue',
  onContinue,
}) {
  const progressLine =
    totalMilestones > 0 ? `${completedMilestones} of ${totalMilestones} lessons done` : null;

  if (blockedMessage) {
    return (
      <section className="program-next" aria-labelledby="program-next-title">
        <p className="program-next__eyebrow" id="program-next-title">
          Your next step
        </p>
        <p className="program-next__blocked">
          <Lock size={16} strokeWidth={2.25} aria-hidden />
          {blockedMessage}
        </p>
        {blockedCta && (
          <Link to={blockedCta.href} className="btn btn-primary program-next__cta">
            {blockedCta.label}
            <ArrowRight size={18} aria-hidden />
          </Link>
        )}
        {progressLine && <p className="program-next__progress">{progressLine}</p>}
      </section>
    );
  }

  if (!nextTaskState) {
    return (
      <section className="program-next program-next--done" aria-labelledby="program-next-title">
        <p className="program-next__eyebrow" id="program-next-title">
          Your next step
        </p>
        <p className="program-next__caught-up">
          <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden />
          You&rsquo;re up to date — every unlocked lesson is complete.
        </p>
        {progressLine && <p className="program-next__progress">{progressLine}</p>}
      </section>
    );
  }

  const { task, status } = nextTaskState;
  const Icon = taskTypeIcon(getTypeIcon(task.type));
  const weekCode = getWeekCode(task);
  const actionRequired = isLearnerActionRequired(status);

  return (
    <section className="program-next" aria-labelledby="program-next-title">
      <p className="program-next__eyebrow" id="program-next-title">
        Your next step
      </p>

      {actionRequired && (
        <p className="alert alert-error program-next__alert" role="alert">
          Your reviewer asked for changes — open the lesson to read the feedback and resubmit.
        </p>
      )}

      <h2 className="program-next__title">
        {weekCode && <span className="program-next__code">{weekCode}</span>}
        {task.title}
      </h2>

      <p className="program-next__meta">
        <Icon size={15} aria-hidden />
        {getDurationHint(task)}
        {phaseTitle && <span className="program-next__phase">{phaseTitle}</span>}
      </p>

      <button type="button" className="btn btn-primary program-next__cta" onClick={onContinue}>
        {actionRequired ? 'Review feedback' : continueLabel}
        <ArrowRight size={18} aria-hidden />
      </button>

      {progressLine && <p className="program-next__progress">{progressLine}</p>}
    </section>
  );
}
