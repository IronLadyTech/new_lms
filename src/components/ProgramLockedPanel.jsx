import { Link } from 'react-router-dom';
import { Lock, ArrowRight, MessageCircle } from 'lucide-react';
import { IRON_LADY_CONTACT_EMAIL } from '../utils/constants';
import { PROGRAM_ACCESS } from '../utils/programAccess';

/**
 * Shown when a learner opens a program they are not entitled to.
 */
export default function ProgramLockedPanel({
  title = 'Program locked',
  message = 'This program is not part of your current enrollment.',
  state = PROGRAM_ACCESS.LOCKED,
  programLabel = 'this program',
}) {
  const isUpcoming = state === PROGRAM_ACCESS.UPCOMING;

  return (
    <div className="program-lock" role="status">
      <span className="program-lock__icon" aria-hidden="true">
        <Lock size={28} strokeWidth={2} />
      </span>
      <p className="program-lock__eyebrow">
        {isUpcoming ? 'Upcoming in your journey' : 'Access restricted'}
      </p>
      <h1 className="program-lock__title">{title}</h1>
      <p className="program-lock__message">{message}</p>
      <p className="program-lock__hint muted">
        Iron Lady path: LEP → 100BM → MBW. Each program opens only with enrollment —{' '}
        {programLabel} stays locked until Iron Lady unlocks it for you.
      </p>
      <div className="program-lock__actions">
        <Link to="/app/home" className="btn btn-primary">
          Back to programs <ArrowRight size={16} aria-hidden />
        </Link>
        <a
          className="btn btn-outline"
          href={`mailto:${IRON_LADY_CONTACT_EMAIL}?subject=${encodeURIComponent(
            `Unlock ${programLabel}`
          )}`}
        >
          <MessageCircle size={16} aria-hidden />
          Speak to our Counsellor
        </a>
      </div>
    </div>
  );
}
