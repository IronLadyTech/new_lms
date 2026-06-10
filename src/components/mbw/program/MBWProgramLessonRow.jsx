import {
  Check,
  Lock,
  Video,
  FileText,
  Link2,
  Table2,
  Upload,
  Mic,
  PlayCircle,
} from 'lucide-react';
import { getTaskDurationHint } from '../../../utils/mbwProgramUtils';

const ICONS = {
  video: Video,
  text: FileText,
  link: Link2,
  template: Table2,
  document: Upload,
  recording: Mic,
  lesson: PlayCircle,
};

function StatusControl({ visual }) {
  if (visual === 'done') {
    return (
      <span className="mbw-lesson-row__status mbw-lesson-row__status--done" aria-label="Completed">
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }
  if (visual === 'pending') {
    return <span className="mbw-lesson-row__status mbw-lesson-row__status--pending" aria-label="In progress" />;
  }
  if (visual === 'current') {
    return <span className="mbw-lesson-row__status mbw-lesson-row__status--current" aria-label="Current lesson" />;
  }
  if (visual === 'locked') {
    return (
      <span className="mbw-lesson-row__status mbw-lesson-row__status--locked" aria-label="Locked">
        <Lock size={14} />
      </span>
    );
  }
  return <span className="mbw-lesson-row__status mbw-lesson-row__status--available" aria-label="Available" />;
}

export default function MBWProgramLessonRow({
  title,
  typeIcon,
  durationHint,
  rowState,
  isActive,
  showLockReason = false,
  onSelect,
}) {
  const Icon = ICONS[typeIcon] || PlayCircle;
  const { visual, reason, clickable } = rowState;
  const locked = visual === 'locked';

  return (
    <div
      className={`mbw-lesson-row${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}${visual === 'current' ? ' is-current' : ''}`}
    >
      <button
        type="button"
        className="mbw-lesson-row__main"
        disabled={!clickable}
        aria-current={isActive ? 'true' : undefined}
        title={locked && reason && !showLockReason ? reason : undefined}
        onClick={() => clickable && onSelect?.()}
      >
        <span className="mbw-lesson-row__type" aria-hidden>
          <Icon size={18} />
        </span>
        <span className="mbw-lesson-row__body">
          <span className="mbw-lesson-row__title">{title}</span>
          <span className="mbw-lesson-row__meta">{durationHint}</span>
        </span>
        <StatusControl visual={visual} />
      </button>
      {locked && reason && showLockReason && (
        <p className="mbw-lesson-row__lock-reason">
          <span className="mbw-lesson-row__lock-pill">{reason}</span>
        </p>
      )}
    </div>
  );
}
