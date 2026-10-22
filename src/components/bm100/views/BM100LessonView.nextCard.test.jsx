// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100LessonView from './BM100LessonView';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../../services/mbwService';

/**
 * The next lesson, shown locked, with what opens it.
 *
 * The page decides the wording from the next lesson's own lock (LEP passes
 * `lockedNext`); the view only shows it. A page that passes nothing (100BM)
 * keeps its sentence.
 */

vi.mock('../../../hooks/useLessonAsset', () => ({
  useLessonAsset: () => ({ url: '', loading: false, reason: null }),
}));
vi.mock('../../../hooks/useMediaQuery', () => ({ default: () => true }));

afterEach(cleanup);

const activeState = (over = {}) => ({
  task: {
    id: 't1',
    title: 'Maximise Key Relationships',
    description: 'Fill it in.',
    type: TASK_TYPES.CHECKLIST,
    checklistItems: ['Done'],
    phase: 'day-2',
  },
  submission: null,
  status: SUBMISSION_STATUS.UNLOCKED,
  watched: true,
  canSubmit: true,
  isComplete: false,
  prevTaskId: null,
  ...over,
});

const NEXT = { title: 'Purpose Peg Table', note: 'Unlocks when you finish this lesson' };

const renderView = (props = {}) =>
  render(
    <MemoryRouter>
      <BM100LessonView
        activeState={activeState()}
        userId="u1"
        threshold={0.9}
        showPrevCta={false}
        showNextCta={false}
        onBack={vi.fn()}
        onWatchProgress={vi.fn()}
        onWatchComplete={vi.fn()}
        onSubmit={vi.fn()}
        onSaveTemplate={vi.fn()}
        onAddRecurringPost={vi.fn()}
        onActionComplete={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('the next lesson, locked', () => {
  it('names the next lesson and says what opens it', () => {
    renderView({ lockedNext: NEXT });
    expect(screen.getByText('Unlocks when you finish this lesson')).toBeTruthy();
    expect(screen.getByText('Purpose Peg Table')).toBeTruthy();
    expect(screen.queryByText('Finish this lesson to continue.')).toBeNull();
  });

  it('shows whatever reason the page gives, such as payment', () => {
    renderView({
      lockedNext: { title: 'Week 1 Engagement Form', note: 'Opens with full program payment' },
    });
    expect(screen.getByText('Opens with full program payment')).toBeTruthy();
    expect(screen.queryByText('Unlocks when you finish this lesson')).toBeNull();
  });

  it('is not a control, since there is nowhere to go yet', () => {
    renderView({ lockedNext: NEXT });
    expect(screen.queryByRole('button', { name: /Purpose Peg Table/ })).toBeNull();
  });

  it('gives way to the Next button once the lesson is finished', () => {
    renderView({
      lockedNext: NEXT,
      activeState: activeState({ isComplete: true }),
      showNextCta: true,
    });
    expect(screen.queryByText('Unlocks when you finish this lesson')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next lesson' })).toBeTruthy();
  });

  it('keeps the plain sentence where the page passes no locked lesson, as 100BM does', () => {
    renderView();
    expect(screen.getByText('Finish this lesson to continue.')).toBeTruthy();
    expect(screen.queryByText('Unlocks when you finish this lesson')).toBeNull();
  });
});

describe('Previous and Next as cards, on a LEP lesson', () => {
  const CONTEXT = {
    programTitle: 'Leadership Essentials Program',
    sectionLabel: 'Day 2 · Strategies and Tactics',
    position: { index: 3, total: 6 },
    onBack: vi.fn(),
  };

  it('names the previous lesson on its card', () => {
    renderView({
      showPrevCta: true,
      prevLessonTitle: 'Powerful Extreme Responding',
      lessonContext: CONTEXT,
    });
    expect(
      screen.getByRole('button', { name: 'Previous lesson: Powerful Extreme Responding' })
    ).toBeTruthy();
    expect(document.querySelector('.mbw-lesson-nav--cards')).not.toBeNull();
  });

  it('keeps the plain Previous button without a lesson context, as 100BM does', () => {
    renderView({ showPrevCta: true, prevLessonTitle: 'Powerful Extreme Responding' });
    expect(screen.getByRole('button', { name: 'Previous lesson' })).toBeTruthy();
    expect(document.querySelector('.mbw-lesson-nav--cards')).toBeNull();
  });
});
