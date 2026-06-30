import { ChevronDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MBW_SECTION_STATUS } from '../../../data/mbwProgramStructure';
import MBWProgramLessonRow from './MBWProgramLessonRow';
import {
  getLessonRowState,
  getTaskTypeIcon,
  getTaskDurationHint,
  getSectionLockDisplay,
  isRegistrationPaymentLocked,
  REGISTRATION_PAYMENT_LOCK_TOOLTIP,
} from '../../../utils/mbwProgramUtils';
import { SUBMISSION_STATUS } from '../../../services/mbwService';

function SectionDot({ status }) {
  const cls =
    status === MBW_SECTION_STATUS.DONE
      ? 'done'
      : status === MBW_SECTION_STATUS.IN_PROGRESS
        ? 'active'
        : 'locked';
  return <span className={`mbw-section-card__dot mbw-section-card__dot--${cls}`} aria-hidden />;
}

export default function MBWProgramSection({
  section,
  sectionProgress,
  profile,
  expanded,
  isCurrent,
  taskStates,
  activeTaskId,
  nextTaskId,
  onToggle,
  onSelectLesson,
}) {
  const progress = sectionProgress[section.id] || { done: 0, total: 0, status: 'locked', unlocked: false };
  const lockDisplay = getSectionLockDisplay(section, sectionProgress, profile);
  const paymentLocked = isRegistrationPaymentLocked(section, sectionProgress, profile);
  const panelId = `mbw-section-${section.id}`;

  return (
    <article
      className={`mbw-section-card${expanded ? ' is-expanded' : ''}${isCurrent ? ' is-current' : ''}${!progress.unlocked ? ' is-section-locked' : ''}${paymentLocked ? ' is-payment-locked' : ''}`}
    >
      <h3 className="mbw-section-card__heading">
        <button
          type="button"
          className="mbw-section-card__head"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <SectionDot status={progress.status} />
          <span className="mbw-section-card__titles">
            <span className="mbw-section-card__name">{section.title}</span>
            <span className="mbw-section-card__sub">{section.subtitle}</span>
          </span>
          <span className="mbw-section-card__mini">
            {progress.done}/{progress.total}
          </span>
          {paymentLocked && (
            <span
              className="mbw-section-card__pay-lock"
              title={REGISTRATION_PAYMENT_LOCK_TOOLTIP}
              aria-label={REGISTRATION_PAYMENT_LOCK_TOOLTIP}
              role="img"
            >
              <Lock size={16} strokeWidth={2.25} aria-hidden />
            </span>
          )}
          <ChevronDown size={18} className="mbw-section-card__chevron" aria-hidden />
        </button>
      </h3>

      <div id={panelId} className="mbw-section-card__panel" hidden={!expanded}>
        {!progress.unlocked && lockDisplay ? (
          <div className="mbw-section-card__locked-panel">
            <LockMessage
              message={lockDisplay.message}
              cta={lockDisplay.cta}
              showLockIcon={paymentLocked}
              tooltip={paymentLocked ? REGISTRATION_PAYMENT_LOCK_TOOLTIP : undefined}
            />
          </div>
        ) : section.usesTaskEngine && taskStates?.length ? (
          <ul className="mbw-section-card__lessons">
            {(() => {
              const firstLockedId = taskStates.find(
                (ts) => ts.status === SUBMISSION_STATUS.LOCKED
              )?.task.id;
              return taskStates.map((ts) => {
                const rowState = getLessonRowState(ts, activeTaskId, nextTaskId);
                return (
                  <li key={ts.task.id}>
                    <MBWProgramLessonRow
                      title={ts.task.title}
                      typeIcon={getTaskTypeIcon(ts.task.type)}
                      durationHint={getTaskDurationHint(ts.task)}
                      rowState={rowState}
                      isActive={ts.task.id === activeTaskId}
                      showLockReason={ts.task.id === firstLockedId}
                      onSelect={() => onSelectLesson(ts.task.id)}
                    />
                  </li>
                );
              });
            })()}
          </ul>
        ) : (
          <div className="mbw-section-card__locked-panel">
            <p className="mbw-section-card__coming">Content for this section is being prepared for your batch.</p>
            {section.unlockCta && (
              <Link to={section.unlockCta.href} className="btn btn-outline btn-sm">
                {section.unlockCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function LockMessage({ message, cta, showLockIcon = false, tooltip }) {
  return (
    <>
      <p className={showLockIcon ? 'mbw-section-card__locked-msg mbw-section-card__locked-msg--pay' : 'mbw-section-card__locked-msg'}>
        {showLockIcon && (
          <span
            className="mbw-section-card__pay-lock mbw-section-card__pay-lock--inline"
            title={tooltip || message}
            aria-label={tooltip || message}
            role="img"
          >
            <Lock size={15} strokeWidth={2.25} aria-hidden />
          </span>
        )}
        {message}
      </p>
      {cta && (
        <Link to={cta.href} className="btn btn-outline btn-sm">
          {cta.label}
        </Link>
      )}
    </>
  );
}
