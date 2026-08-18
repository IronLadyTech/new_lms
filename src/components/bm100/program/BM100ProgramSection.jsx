import { ChevronDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BM100_SECTION_STATUS } from '../../../data/bm100ProgramStructure';
import ProgramLessonList from '../../mbw/program/ProgramLessonList';
import {
  getLessonRowState,
  getTaskTypeIcon,
  getTaskDurationHint,
  getTaskKindLabel,
  getSectionLockDisplay,
  isRegistrationPaymentLocked,
  REGISTRATION_PAYMENT_LOCK_TOOLTIP,
} from '../../../utils/bm100ProgramUtils';

function SectionDot({ status }) {
  const cls =
    status === BM100_SECTION_STATUS.DONE
      ? 'done'
      : status === BM100_SECTION_STATUS.IN_PROGRESS
        ? 'active'
        : 'locked';
  return <span className={`mbw-section-card__dot mbw-section-card__dot--${cls}`} aria-hidden />;
}

export default function BM100ProgramSection({
  section,
  sectionIndex,
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
  const progress = sectionProgress[section.id] || {
    done: 0,
    total: 0,
    status: 'locked',
    unlocked: false,
  };
  const lockDisplay = getSectionLockDisplay(section, sectionProgress, profile);
  const paymentLocked = isRegistrationPaymentLocked(section, sectionProgress, profile);
  // Any locked section shows the icon now, not just payment ones — a bare
  // "Locked" with no symbol read as available.
  /*
   * The padlock means money, not progress. A learner who has paid in full sees
   * every section without a padlock, even the ones they cannot open yet —
   * those are waiting on tasks, and saying so in words is honest where a
   * padlock reads as "buy something". An expired window keeps the padlock,
   * because that is access ending rather than work outstanding.
   */
  const accessLocked = paymentLocked || Boolean(lockDisplay?.expired);
  const lockReason = lockDisplay?.expired
    ? lockDisplay.message
    : REGISTRATION_PAYMENT_LOCK_TOOLTIP;
  const panelId = `bm100-section-${section.id}`;

  const moduleStats = !progress.unlocked
    ? 'Locked'
    : progress.total > 0
      ? `${progress.total} lessons · ${progress.done}/${progress.total} done`
      : section.subtitle;

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
            {sectionIndex != null && (
              <span className="mbw-section-card__module">Module {sectionIndex}</span>
            )}
            <span className="mbw-section-card__name">{section.title}</span>
            <span className="mbw-section-card__sub">{moduleStats}</span>
          </span>
          <span className="mbw-section-card__mini">
            {progress.done}/{progress.total}
          </span>
          {accessLocked && (
            <span
              className="mbw-section-card__pay-lock"
              title={lockReason}
              aria-label={lockReason}
              role="img"
            >
              <Lock size={16} strokeWidth={2.25} aria-hidden />
            </span>
          )}
          <ChevronDown size={18} className="mbw-section-card__chevron" aria-hidden />
        </button>
      </h3>

      <div id={panelId} className="mbw-section-card__panel" hidden={!expanded}>
        {accessLocked && lockDisplay ? (
          /* Payment outstanding or the window closed: the reason, and nothing
             else. There is no point previewing work they have not bought. */
          <div className="mbw-section-card__locked-panel">
            <LockMessage
              message={lockDisplay.message}
              cta={lockDisplay.cta}
              showLockIcon
              tooltip={paymentLocked ? REGISTRATION_PAYMENT_LOCK_TOOLTIP : lockDisplay.message}
            />
          </div>
        ) : !progress.unlocked && lockDisplay ? (
          /*
           * Paid, but waiting on earlier tasks. They own this, so they can see
           * what is in it — every lesson listed, none of them startable. The
           * message above says what to finish first.
           */
          <>
            <div className="mbw-section-card__locked-panel">
              <LockMessage message={lockDisplay.message} cta={lockDisplay.cta} />
            </div>
            {section.usesTaskEngine && taskStates?.length ? (
              <ProgramLessonList
                taskStates={taskStates}
                activeTaskId={activeTaskId}
                getRowState={(ts) => ({
                  ...getLessonRowState(ts, activeTaskId, nextTaskId),
                  clickable: false,
                })}
                getTypeIcon={getTaskTypeIcon}
                getDurationHint={getTaskDurationHint}
                getKindLabel={getTaskKindLabel}
                onSelectLesson={() => {}}
              />
            ) : null}
          </>
        ) : section.usesTaskEngine && taskStates?.length ? (
          <ProgramLessonList
            taskStates={taskStates}
            activeTaskId={activeTaskId}
            getRowState={(ts) => getLessonRowState(ts, activeTaskId, nextTaskId)}
            getTypeIcon={getTaskTypeIcon}
            getDurationHint={getTaskDurationHint}
            getKindLabel={getTaskKindLabel}
            onSelectLesson={onSelectLesson}
          />
        ) : (
          <div className="mbw-section-card__locked-panel">
            <p className="mbw-section-card__coming">
              Content for this section is being prepared for your batch.
            </p>
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
      <p
        className={
          showLockIcon
            ? 'mbw-section-card__locked-msg mbw-section-card__locked-msg--pay'
            : 'mbw-section-card__locked-msg'
        }
      >
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
