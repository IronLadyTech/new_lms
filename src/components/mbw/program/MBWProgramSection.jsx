import { ChevronDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MBW_SECTION_STATUS } from '../../../data/mbwProgramStructure';
import RefreshAccessButton from '../../ui/RefreshAccessButton';
import ProgramLessonList from './ProgramLessonList';
import {
  getLessonRowState,
  getTaskTypeIcon,
  getTaskDurationHint,
  getTaskKindLabel,
  getSectionLockDisplay,
  isRegistrationPaymentLocked,
  REGISTRATION_PAYMENT_LOCK_TOOLTIP,
} from '../../../utils/mbwProgramUtils';

// Behance-inspired per-module progress ring (gold fill = progress accent).
// Only shown on unlocked sections.
function SectionRing({ done, total, status }) {
  const pct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;
  const isDone = status === MBW_SECTION_STATUS.DONE || (total > 0 && done >= total);
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;

  return (
    <span
      className={`mbw-section-ring${isDone ? ' mbw-section-ring--done' : ''}`}
      role="img"
      aria-label={`${pct}% complete — ${done} of ${total}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="mbw-section-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="mbw-section-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="mbw-section-ring__pct">{pct}%</span>
    </span>
  );
}

export default function MBWProgramSection({
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
  railMode = false,
}) {
  const progress = sectionProgress[section.id] || {
    done: 0,
    total: 0,
    status: 'locked',
    unlocked: false,
  };
  const lockDisplay = getSectionLockDisplay(section, sectionProgress, profile);
  const paymentLocked = isRegistrationPaymentLocked(section, sectionProgress, profile);
  const accessLocked = paymentLocked || Boolean(lockDisplay?.expired);
  const lockReason = lockDisplay?.expired
    ? lockDisplay.message
    : REGISTRATION_PAYMENT_LOCK_TOOLTIP;
  const panelId = `mbw-section-${section.id}`;

  const usesEngine = section.usesTaskEngine && Array.isArray(taskStates) && taskStates.length > 0;
  const isDoneSection =
    progress.status === MBW_SECTION_STATUS.DONE ||
    (progress.total > 0 && progress.done >= progress.total);

  const resumeId = (() => {
    if (!usesEngine) return null;
    const ids = taskStates.map((ts) => ts.task.id);
    if (nextTaskId && ids.includes(nextTaskId)) return nextTaskId;
    const firstIncomplete = taskStates.find((ts) => !ts.isComplete);
    return (firstIncomplete || taskStates[0]).task.id;
  })();

  const ctaLabel = isDoneSection ? 'Review' : progress.done > 0 ? 'Continue' : 'Start';

  const lessonTotal = progress.total || (usesEngine ? taskStates.length : 0);
  const moduleStats = railMode
    ? !progress.unlocked
      ? lessonTotal > 0
        ? `${lessonTotal} lessons`
        : section.subtitle || 'Locked'
      : lessonTotal > 0
        ? `${lessonTotal} lessons · ${progress.done}/${lessonTotal} done`
        : section.subtitle
    : !progress.unlocked
      ? 'Locked'
      : progress.total > 0
        ? `${progress.total} lessons · ${progress.done}/${progress.total} done`
        : section.subtitle;

  const indexLabel =
    sectionIndex != null ? String(sectionIndex).padStart(2, '0') : null;

  return (
    <article
      className={`mbw-section-card${expanded ? ' is-expanded' : ''}${isCurrent ? ' is-current' : ''}${!progress.unlocked ? ' is-section-locked' : ''}${paymentLocked ? ' is-payment-locked' : ''}${railMode ? ' mbw-section-card--rail' : ''}`}
    >
      <div className="mbw-section-card__head">
        <h3 className="mbw-section-card__heading">
          <button
            type="button"
            className={`mbw-section-card__toggle${railMode ? ' mbw-section-card__toggle--rail' : ''}`}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={onToggle}
          >
            {railMode ? (
              <>
                {indexLabel && (
                  <span className="mbw-section-card__index" aria-hidden>
                    {indexLabel}
                  </span>
                )}
                <span className="mbw-section-card__copy">
                  <span className="mbw-section-card__name">{section.title}</span>
                  <span className="mbw-section-card__sub">{moduleStats}</span>
                </span>
                {!progress.unlocked && (
                  <Lock size={16} className="mbw-section-card__lock" aria-hidden />
                )}
                <ChevronDown size={18} className="mbw-section-card__chevron" aria-hidden />
              </>
            ) : (
              <>
                <span className="mbw-section-card__titles">
                  {sectionIndex != null && (
                    <span className="mbw-section-card__module">
                      <span className="mbw-section-card__module-label">Module </span>
                      {sectionIndex}
                    </span>
                  )}
                  <span className="mbw-section-card__name">{section.title}</span>
                  <span className="mbw-section-card__sub">{moduleStats}</span>
                </span>
                <ChevronDown size={18} className="mbw-section-card__chevron" aria-hidden />
              </>
            )}
          </button>
        </h3>

        {!railMode && (
        <div className="mbw-section-card__action">
          {!progress.unlocked ? (
            <button
              type="button"
              className="btn btn-sm mbw-section-card__cta mbw-section-card__cta--locked"
              disabled
              aria-label={lockDisplay?.message || 'Locked'}
            >
              {accessLocked && <Lock size={14} strokeWidth={2.25} aria-hidden />}
              Start
            </button>
          ) : (
            <>
              {resumeId ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm mbw-section-card__cta"
                  onClick={() => onSelectLesson?.(resumeId)}
                >
                  {ctaLabel}
                </button>
              ) : section.unlockCta ? (
                <Link
                  to={section.unlockCta.href}
                  className="btn btn-outline btn-sm mbw-section-card__cta"
                >
                  {section.unlockCta.label}
                </Link>
              ) : null}
              <SectionRing done={progress.done} total={progress.total} status={progress.status} />
            </>
          )}
        </div>
        )}
      </div>

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
            {/* Only where payment is the reason. A sequence lock will not lift
                however many times Zoho is asked. */}
            {paymentLocked && <RefreshAccessButton />}
          </div>
        ) : !progress.unlocked && lockDisplay ? (
          /*
           * Paid, but waiting on earlier work. They own this quarter, so they
           * can see everything in it — listed, and none of it startable.
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
                  // The section's own message is the accurate one; a row must
                  // not invent a different reason for the same lock.
                  reason: lockDisplay.message,
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
