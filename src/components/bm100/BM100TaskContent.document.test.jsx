// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100TaskContent from './BM100TaskContent';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * Reading material in the lesson player.
 *
 * This component is shared: LEP and 100BM both render it. Only a task that
 * carries a `readingDocument` gets the document in the player, so 100BM's
 * lessons, which carry none, render exactly as they did.
 */

vi.mock('../../hooks/useLessonAsset', () => ({
  useLessonAsset: () => ({ url: '', loading: false, reason: null }),
}));
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => true }));
vi.mock('../lessons/LessonDocument', () => ({
  default: ({ document }) => <div data-testid="lesson-document">{document.label}</div>,
}));

afterEach(cleanup);

const state = (task, over = {}) => ({
  task: {
    id: 't1',
    title: 'A lesson',
    description: 'Read it.',
    type: TASK_TYPES.CHECKLIST,
    checklistItems: ['I have read it'],
    phase: 'orientation',
    ...task,
  },
  submission: null,
  status: SUBMISSION_STATUS.UNLOCKED,
  watched: true,
  canSubmit: true,
  isComplete: false,
  prevTaskId: null,
  ...over,
});

const renderLesson = (taskState, playerControls = null) =>
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
        playerControls={playerControls}
      />
    </MemoryRouter>
  );

const DOC = { url: '/templates/lep/lep-program-framework.pdf', label: 'Program Information' };

describe('a lesson with reading material', () => {
  it('shows the document in the player', () => {
    renderLesson(state({ readingDocument: DOC }));
    expect(screen.getByTestId('lesson-document').textContent).toBe('Program Information');
  });

  it('keeps the assignment below the document', () => {
    renderLesson(state({ readingDocument: DOC }));
    expect(document.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('does not show a locked lesson’s document', () => {
    renderLesson(state({ readingDocument: DOC }, { status: SUBMISSION_STATUS.LOCKED }));
    expect(screen.queryByTestId('lesson-document')).toBeNull();
  });

  it('leaves a lesson without one as it was', () => {
    renderLesson(state({}));
    expect(screen.queryByTestId('lesson-document')).toBeNull();
  });
});

describe('the player bar', () => {
  const controls = () => ({ expanded: false, onToggleExpand: vi.fn() });

  afterEach(() => {
    delete document.fullscreenEnabled;
  });

  it('offers Expand when the page passes the controls', () => {
    renderLesson(state({ readingDocument: DOC }), controls());
    expect(screen.getByRole('button', { name: 'Expand lesson' })).toBeTruthy();
  });

  it('hides Expand on a form-only lesson — there is no player to widen', () => {
    renderLesson(state({}), controls());
    expect(screen.queryByRole('button', { name: 'Expand lesson' })).toBeNull();
  });

  it('shows no bar at all on a form-only lesson, hidden rail or not', () => {
    /* The page puts a "Course content" tab on the page edge to bring the column
       back, so the bar no longer has to survive as its only home. */
    renderLesson(state({}), { expanded: true, onToggleExpand: vi.fn() });
    expect(document.querySelector('.lesson-player-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go to assignment' })).toBeNull();
  });

  it('offers fullscreen for a document', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    renderLesson(state({ readingDocument: DOC }), controls());
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
  });

  it('leaves a lesson without the controls as it was, which is every 100BM lesson', () => {
    renderLesson(state({ readingDocument: DOC }));
    expect(screen.queryByRole('button', { name: 'Expand lesson' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull();
  });
});

describe('a document lesson’s bar', () => {
  it('carries the document’s PDF link', () => {
    renderLesson(state({ readingDocument: DOC }), { expanded: false, onToggleExpand: vi.fn() });
    expect(screen.getByRole('link', { name: /open pdf/i }).getAttribute('href')).toBe(DOC.url);
  });
});
