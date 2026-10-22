import { useState } from 'react';
import { Check, ChevronDown, ExternalLink, FolderOpen, Lock, Play } from 'lucide-react';
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
  tag = null,
  iconInMeta = false,
  resources = [],
}) {
  const Icon = taskTypeIcon(typeIcon);
  const { visual, reason, clickable } = rowState;
  const locked = visual === 'locked';
  const [resourcesOpen, setResourcesOpen] = useState(false);

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
            {/* LEP's course content list leads with status, so the kind of
                lesson moves here as a small icon beside its label. */}
            {iconInMeta && <Icon size={13} className="mbw-lesson-row__meta-icon" aria-hidden />}
            {kindLabel && (
              <span
                className={`mbw-lesson-row__kind${kindLabel === 'Assignment' ? ' mbw-lesson-row__kind--assignment' : ''}`}
              >
                {kindLabel}
              </span>
            )}
            {durationHint && <span className="mbw-lesson-row__duration">{durationHint}</span>}
            {tag && !iconInMeta && (
              <span className={`mbw-lesson-row__tag mbw-lesson-row__tag--${tag.tone}`}>
                {tag.label}
              </span>
            )}
          </span>
        </span>
        {/* LEP's list gives the tag its own column at the end of the row. */}
        {tag && iconInMeta && (
          <span
            className={`mbw-lesson-row__tag mbw-lesson-row__tag--${tag.tone} mbw-lesson-row__tag--end`}
          >
            {tag.label}
          </span>
        )}
        <span className="mbw-lesson-row__node">
          {/* LEP's list marks the current lesson with a ring, not a play icon:
              its status column only ever shows a tick, a ring or a lock. */}
          <StatusControl
            visual={iconInMeta && isActive && visual !== 'done' ? 'current' : visual}
            isActive={isActive && !iconInMeta}
          />
        </span>
      </button>
      {/* A lesson's handouts sit with the lesson, not under its questions. */}
      {resources.length > 0 && !locked && (
        <div className="mbw-lesson-row__resources">
          <button
            type="button"
            className="mbw-lesson-row__resources-toggle"
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen((open) => !open)}
          >
            <FolderOpen size={14} aria-hidden="true" />
            {`Resources (${resources.length})`}
            <ChevronDown size={14} aria-hidden="true" className="mbw-lesson-row__resources-chev" />
          </button>
          {resourcesOpen && (
            <ul className="mbw-lesson-row__resource-list">
              {resources.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label || 'Open resource'}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {locked && reason && showLockReason && (
        <p className="mbw-lesson-row__lock-reason">
          <span className="mbw-lesson-row__lock-pill">{reason}</span>
        </p>
      )}
    </div>
  );
}
