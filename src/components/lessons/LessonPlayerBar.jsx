import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Maximize, Minimize, MoveHorizontal } from 'lucide-react';

function fullscreenSupported() {
  return typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
}

/**
 * The bar under the lesson player: Fullscreen and Expand, as on Udemy.
 *
 * - Fullscreen fills the screen with `fullscreenTarget`. It is offered only when
 *   there is something to fill it with and the browser can: iPhone Safari cannot
 *   put anything but a video fullscreen, and a button that does nothing is worse
 *   than no button.
 * - Expand gives the lesson the page's full width by moving the course content
 *   aside. The page owns that state; this only asks for it to change.
 *
 * @param {{
 *   fullscreenTarget?: { current: HTMLElement | null } | null,
 *   expanded?: boolean,
 *   onToggleExpand?: () => void,
 * }} props
 */
export default function LessonPlayerBar({
  fullscreenTarget = null,
  expanded = false,
  onToggleExpand,
  label = '',
  openUrl = '',
  onJumpToWork,
}) {
  const canFullscreen = Boolean(fullscreenTarget) && fullscreenSupported();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!canFullscreen) return undefined;
    const sync = () =>
      setIsFullscreen(
        Boolean(document.fullscreenElement) &&
          document.fullscreenElement === fullscreenTarget.current
      );
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [canFullscreen, fullscreenTarget]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await fullscreenTarget.current?.requestFullscreen();
    } catch {
      /* Refused by the browser: nothing changed, so nothing to undo. */
    }
  };

  return (
    <div className={`lesson-player-bar${canFullscreen ? '' : ' lesson-player-bar--no-fullscreen'}`}>
      {/* A document's name and its PDF link, on wide screens where the document's
          own header strip is folded into this bar. */}
      {(label || openUrl) && (
        <div className="lesson-player-bar__doc">
          {label && <span className="lesson-player-bar__label">{label}</span>}
          {openUrl && (
            <a
              className="lesson-player-bar__open"
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open PDF <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {onJumpToWork && (
        <button type="button" className="lesson-player-bar__jump" onClick={onJumpToWork}>
          Go to assignment
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
      {canFullscreen && (
        <button
          type="button"
          className="lesson-player-bar__btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize size={18} aria-hidden="true" />
          ) : (
            <Maximize size={18} aria-hidden="true" />
          )}
        </button>
      )}
      {onToggleExpand && (
        <button
          type="button"
          className="lesson-player-bar__btn lesson-player-bar__btn--expand"
          onClick={onToggleExpand}
          aria-pressed={expanded}
          aria-label="Expand lesson"
          title={expanded ? 'Show course content' : 'Expand lesson'}
        >
          <MoveHorizontal size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
