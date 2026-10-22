// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100TaskContent from './BM100TaskContent';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * A LEP lesson's place and kind: breadcrumb, meta row, and when the work went in.
 *
 * Only a page that passes `lessonContext` (LEP) gets these; a 100BM lesson is
 * as it was.
 */

vi.mock('../../hooks/useLessonAsset', () => ({
  useLessonAsset: () => ({ url: '', loading: false, reason: null }),
}));
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => true }));
vi.mock('../lessons/LessonDocument', () => ({ default: () => <div /> }));

afterEach(cleanup);

const CONTEXT = {
  programTitle: 'Leadership Essentials Program',
  sectionLabel: 'Day 2 · Strategies and Tactics',
  position: { index: 3, total: 6 },
};

const state = (over = {}) => ({
  task: {
    id: 'lep-day2-relationships',
    title: 'Maximise Key Relationships',
    description: 'Identify your key relationships.',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'key-relationships',
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

const renderLesson = (taskState, lessonContext = null) =>
  render(
    <MemoryRouter>
      <BM100TaskContent
        variant="lesson"
        taskState={taskState}
        userId="u1"
        onWatchProgress={vi.fn()}
        onWatchComplete={vi.fn()}
        onSubmit={vi.fn()}
        onSaveTemplate={vi.fn()}
        onAddRecurringPost={vi.fn()}
        onActionComplete={vi.fn()}
        threshold={0.9}
        lessonContext={lessonContext}
      />
    </MemoryRouter>
  );

describe('a LEP lesson', () => {
  it('shows where it sits: programme, day and position', () => {
    const onBack = vi.fn();
    renderLesson(state(), { ...CONTEXT, onBack });
    const crumb = screen.getByRole('navigation', { name: 'Lesson location' });
    expect(crumb.textContent).toContain('Leadership Essentials Program');
    expect(crumb.textContent).toContain('Day 2 · Strategies and Tactics');
    expect(crumb.textContent).toContain('Lesson 3 of 6');
    fireEvent.click(screen.getByRole('button', { name: 'Leadership Essentials Program' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('says what kind of lesson it is, with no guessed duration', () => {
    renderLesson(state(), { ...CONTEXT, onBack: vi.fn() });
    expect(screen.getByText('Assignment · Fill template')).toBeTruthy();
    expect(document.querySelector('.lesson-meta').textContent).not.toMatch(/min/);
  });

  it('shows when the work went in, at the top of the work panel', () => {
    renderLesson(
      state({
        status: SUBMISSION_STATUS.SUBMITTED,
        isComplete: true,
        canSubmit: false,
        submission: {
          status: SUBMISSION_STATUS.SUBMITTED,
          submittedAt: '2026-09-14T19:52:00+05:30',
          templateData: { templateId: 'key-relationships', fields: {} },
        },
      }),
      { ...CONTEXT, onBack: vi.fn() }
    );
    const panel = document.querySelector('.lesson-work');
    expect(panel.querySelector('.lesson-work__when').textContent).toMatch(/^Submitted 14 Sep/);
  });

  it('shows no submitted time before anything is sent', () => {
    renderLesson(state(), { ...CONTEXT, onBack: vi.fn() });
    expect(document.querySelector('.lesson-work__when')).toBeNull();
  });
});

describe('a lesson without the context, as every 100BM lesson is', () => {
  it('is unchanged', () => {
    renderLesson(state());
    expect(screen.queryByRole('navigation', { name: 'Lesson location' })).toBeNull();
    expect(screen.queryByText('Assignment · Fill template')).toBeNull();
    expect(document.querySelector('.lesson-work')).toBeNull();
    expect(document.querySelector('.mbw-task--lep')).toBeNull();
  });
});
