import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import TaskContent from '../TaskContent';

export default function MBWLessonView({
  activeState,
  userId,
  threshold,
  successBanner,
  showPrevCta,
  showNextCta,
  nextLessonTitle,
  onBack,
  onWatchProgress,
  onWatchComplete,
  onSubmit,
  onSaveTemplate,
  onAddRecurringPost,
  onActionComplete,
  onGoToPrevious,
  onPrevious,
  onNext,
}) {
  const showLessonNav = showPrevCta || showNextCta || Boolean(successBanner);
  const taskComplete = activeState?.isComplete;

  return (
    <article className="mbw-program-lesson-card" id="mbw-lesson-panel">
      <TaskContent
        taskState={activeState}
        userId={userId}
        threshold={threshold}
        showInlineSuccess={false}
        onWatchProgress={onWatchProgress}
        onWatchComplete={onWatchComplete}
        onSubmit={onSubmit}
        onSaveTemplate={onSaveTemplate}
        onAddRecurringPost={onAddRecurringPost}
        onActionComplete={onActionComplete}
        onGoToPrevious={onGoToPrevious}
      />

      {showLessonNav && (
        <footer className="mbw-lesson-nav mbw-lesson-nav--sticky">
          {successBanner && (
            <div className="mbw-lesson-complete" role="status" aria-live="polite">
              <CheckCircle2 size={20} className="mbw-lesson-complete__icon" aria-hidden />
              <div className="mbw-lesson-complete__text">
                <strong>Lesson saved</strong>
                <span>{successBanner.replace(/^Saved\.?\s*/i, '').trim() || 'Your work was saved successfully.'}</span>
              </div>
            </div>
          )}

          <div className="mbw-lesson-nav__actions">
            {showPrevCta ? (
              <button type="button" className="btn btn-outline mbw-lesson-nav__prev" onClick={onPrevious}>
                <ChevronLeft size={18} aria-hidden />
                <span>Previous</span>
              </button>
            ) : null}

            {showNextCta ? (
              <button
                type="button"
                className="btn btn-primary mbw-lesson-nav__next"
                onClick={onNext}
              >
                <span className="mbw-lesson-nav__next-label">
                  {taskComplete ? 'Next lesson' : 'Continue'}
                </span>
                {nextLessonTitle ? (
                  <span className="mbw-lesson-nav__next-title">{nextLessonTitle}</span>
                ) : null}
                <ChevronRight size={18} className="mbw-lesson-nav__next-chev" aria-hidden />
              </button>
            ) : taskComplete && !showNextCta ? (
              <button type="button" className="btn btn-primary mbw-lesson-nav__next" onClick={onBack}>
                Back to program
              </button>
            ) : null}
          </div>
        </footer>
      )}
    </article>
  );
}
