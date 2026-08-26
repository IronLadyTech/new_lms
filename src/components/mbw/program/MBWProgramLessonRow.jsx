import { Check, Lock, Play } from 'lucide-react';
import { taskTypeIcon } from './taskTypeIcons';

function StatusControl({ visual, isActive }) {
  if (isActive) {
    return (
      <span className="mbw-lesson-row__status mbw-lesson-row__status--playing" aria-label="Playing">
        <Play size={14} fill="currentColor" strokeWidth={0} />
      </span>
    );
  }
  if (visual === 'done') {
    return (
      <span className="mbw-lesson-row__status mbw-lesson-row__status--done" aria-label="Completed">
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }
  if (visual === 'pending') {
    return (
      <span
        className="mbw-lesson-row__status mbw-lesson-row__status--pending"
        aria-label="In progress"
      />
    );
  }
  if (visual === 'current') {
    return (
      <span
        className="mbw-lesson-row__status mbw-lesson-row__status--current"
        aria-label="Current lesson"
      />
    );
  }
  if (visual === 'locked') {
    return (
      <span className="mbw-lesson-row__status mbw-lesson-row__status--locked" aria-label="Locked">
        <Lock size={14} />
      </span>
    );
  }
  return (
    <span
      className="mbw-lesson-row__status mbw-lesson-row__status--available"
      aria-label="Available"
    />
  );
}

export default function MBWProgramLessonRow({
  weekCode,
  title,
  typeIcon,
  kindLabel,
  durationHint,
  rowState,
  isActive,
  showLockReason = false,
  spineStart = false,
  spineEnd = false,
  onSelect,
}) {
  const Icon = taskTypeIcon(typeIcon);
  const { visual, reason, clickable } = rowState;
  const locked = visual === 'locked';

  return (
    <div
      className={`mbw-lesson-row${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}${visual === 'current' ? ' is-current' : ''}${spineStart ? ' is-spine-start' : ''}${spineEnd ? ' is-spine-end' : ''}`}
    >
      <button
        type="button"
        className="mbw-lesson-row__main"
        disabled={!clickable}
        aria-current={isActive ? 'true' : undefined}
        title={locked && reason && !showLockReason ? reason : undefined}
        onClick={() => clickable && onSelect?.()}
      >
        <span className="mbw-lesson-row__lead" aria-hidden>
          <Icon size={18} className="mbw-lesson-row__type" />
        </span>
        <span className="mbw-lesson-row__body">
          <span className="mbw-lesson-row__heading">
            {weekCode && <span className="mbw-lesson-row__code">{weekCode}</span>}
            <span className="mbw-lesson-row__title">{title}</span>
          </span>
          <span className="mbw-lesson-row__meta">
            {kindLabel && (
              <span
                className={`mbw-lesson-row__kind${kindLabel === 'Assignment' ? ' mbw-lesson-row__kind--assignment' : ''}`}
              >
                {kindLabel}
              </span>
            )}
            {durationHint && <span className="mbw-lesson-row__duration">{durationHint}</span>}
          </span>
        </span>
        <span className="mbw-lesson-row__node">
          <StatusControl visual={visual} isActive={isActive} />
        </span>
      </button>
      {locked && reason && showLockReason && (
        <p className="mbw-lesson-row__lock-reason">
          <span className="mbw-lesson-row__lock-pill">{reason}</span>
        </p>
      )}
    </div>
  );
}
