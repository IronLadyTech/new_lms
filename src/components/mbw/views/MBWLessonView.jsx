import { ChevronLeft, ChevronRight } from 'lucide-react';
import TaskContent from '../TaskContent';

export default function MBWLessonView({
  activeState,
  userId,
  threshold,
  successBanner,
  showPrevCta,
  showNextCta,
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
  const showLessonNav = showPrevCta || showNextCta;

  return (
    <article className="mbw-program-lesson-card" id="mbw-lesson-panel">
      <TaskContent
        taskState={activeState}
        userId={userId}
        threshold={threshold}
        successBanner={successBanner}
        onWatchProgress={onWatchProgress}
        onWatchComplete={onWatchComplete}
        onSubmit={onSubmit}
        onSaveTemplate={onSaveTemplate}
        onAddRecurringPost={onAddRecurringPost}
        onActionComplete={onActionComplete}
        onGoToPrevious={onGoToPrevious}
      />
      {showLessonNav && (
        <div className="mbw-lesson-nav">
          {showPrevCta ? (
            <button type="button" className="btn btn-outline mbw-lesson-nav__prev" onClick={onPrevious}>
              <ChevronLeft size={16} /> Previous lesson
            </button>
          ) : (
            <span className="mbw-lesson-nav__spacer" aria-hidden />
          )}
          {showNextCta && (
            <button type="button" className="btn btn-primary mbw-lesson-nav__next" onClick={onNext}>
              Continue to next lesson <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
