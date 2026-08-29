import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import BM100TaskContent from '../BM100TaskContent';
import { DEFAULT_PROGRAM_UI } from '../../../data/programUiAdapters';

export default function BM100LessonView({
  program = DEFAULT_PROGRAM_UI,
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
  courseContent = null,
}) {
  const taskComplete = activeState?.isComplete;

  /*
   * The first lesson of a programme has nothing before it, and Next only
   * appears once the lesson is done — so on lesson one, before any work, the
   * footer rendered nothing at all and the learner was given no sense of where
   * they were or what came next. The bar now stays, carrying the reason.
   */
  const showLessonNav =
    showPrevCta || showNextCta || Boolean(successBanner) || !taskComplete;
  const showNextHint = !showNextCta && !taskComplete;

  return (
    <article className="mbw-program-lesson-card" id={`${program.key}-lesson-panel`}>
      <BM100TaskContent
        program={program}
        taskState={activeState}
        userId={userId}
        threshold={threshold}
        showInlineSuccess={false}
        variant="lesson"
        courseContent={courseContent}
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
                <span>
                  {successBanner.replace(/^Saved\.?\s*/i, '').trim() ||
                    'Your work was saved successfully.'}
                </span>
              </div>
            </div>
          )}

          <div className="mbw-lesson-nav__actions">
            {showPrevCta ? (
              <button
                type="button"
                className="btn btn-outline mbw-lesson-nav__prev"
                onClick={onPrevious}
                aria-label="Previous lesson"
              >
                <ChevronLeft size={18} aria-hidden />
                <span className="mbw-lesson-nav__prev-label">Previous</span>
              </button>
            ) : null}

            {showNextCta ? (
              <button
                type="button"
                className="btn btn-primary mbw-lesson-nav__next"
                onClick={onNext}
                aria-label={taskComplete ? 'Next lesson' : 'Continue lesson'}
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
              <button
                type="button"
                className="btn btn-primary mbw-lesson-nav__next"
                onClick={onBack}
              >
                Back to program
              </button>
            ) : null}

            {/*
              Says what unlocks the next lesson. A disabled button would be the
              obvious alternative, but this view cannot tell "no next lesson
              exists" from "the next one is not open yet" — showNextCta already
              folds both together — and a dead button on the last lesson of a
              programme would be a worse lie than a sentence.
            */}
            {showNextHint ? (
              <p className="mbw-lesson-nav__hint">Finish this lesson to continue.</p>
            ) : null}
          </div>
        </footer>
      )}
    </article>
  );
}
