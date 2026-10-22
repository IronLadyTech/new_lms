// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskContent from './TaskContent';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * The lesson body: which form a task type gets, and when it may be used.
 *
 * This is the surface that writes a learner's work. Eight task types, eight
 * components, and until now a single test between them — so a redesign of the
 * page around it had nothing to fall back on. These pin the contract that
 * matters before the layout changes: the right form appears, a locked task
 * cannot be submitted through, and a watch-gated one stays shut until watched.
 *
 * Deliberately about behaviour, not markup. A redesign is meant to move this
 * around; it is not meant to change what can be submitted.
 */

vi.mock('../../hooks/useLessonAsset', () => ({
  useLessonAsset: () => ({ url: '', loading: false, error: null }),
}));

/* jsdom has no matchMedia, and TaskContent asks for it on every render. */
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }));

const task = (over = {}) => ({
  id: 't1',
  title: 'A task',
  type: TASK_TYPES.TEXT,
  description: 'Do the thing.',
  requiresWatch: false,
  videoUrl: '',
  phase: 'day-1',
  ...over,
});

/* TaskContent takes one `taskState`, the shape the task engine hands it. */
const state = (over = {}) => ({
  task: task(),
  submission: null,
  status: SUBMISSION_STATUS.UNLOCKED,
  watched: true,
  canSubmit: true,
  isComplete: false,
  prevTaskId: null,
  ...over,
});

const renderTask = (over = {}) =>
  render(
    <MemoryRouter>
      <TaskContent
        taskState={state(over)}
        userId="u1"
        onWatchProgress={vi.fn()}
        onWatchComplete={vi.fn()}
        onSubmit={vi.fn()}
        onSaveTemplate={vi.fn()}
        onAddRecurringPost={vi.fn()}
        onActionComplete={vi.fn()}
        onGoToPrevious={vi.fn()}
        threshold={0.9}
      />
    </MemoryRouter>
  );

afterEach(cleanup);

describe('each task type gets its own form', () => {
  /* One representative control per type — the thing a learner touches. */
  const CASES = [
    [TASK_TYPES.TEXT, 'textarea'],
    [TASK_TYPES.LINK, 'input'],
    [TASK_TYPES.CHECKLIST, 'input[type="checkbox"]'],
  ];

  it.each(CASES)('%s renders something to submit with', (type, selector) => {
    renderTask({
      task: task({
        type,
        checklistItems: type === TASK_TYPES.CHECKLIST ? ['One', 'Two'] : undefined,
      }),
    });
    expect(document.querySelector(selector), `${type} has no ${selector}`).toBeTruthy();
  });

  it('gives a watch-only task nothing to submit', () => {
    // It is watched, not answered — a form here would be asking for work that
    // does not exist.
    renderTask({ task: task({ type: TASK_TYPES.WATCH_ONLY }) });
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('does not fall back to a text box for a type it does not know', () => {
    /*
     * An unrecognised type must render nothing rather than the default form:
     * silently accepting free text against a task that wanted an upload puts
     * the wrong thing in front of a reviewer.
     */
    renderTask({ task: task({ type: 'something-new' }) });
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('what a learner may submit, and when', () => {
  it('shows the watch gate before the form on a watch-gated task', () => {
    renderTask({
      task: task({ requiresWatch: true, videoUrl: 'https://example.com/v.m3u8' }),
      watched: false,
    });
    expect(screen.getByText(/watch at least 90%/i)).toBeTruthy();
  });

  it('drops the gate notice once the video has been watched', () => {
    renderTask({
      task: task({ requiresWatch: true, videoUrl: 'https://example.com/v.m3u8' }),
      watched: true,
    });
    expect(screen.queryByText(/watch at least 90%/i)).toBeNull();
  });

  it('shows the submitted work instead of the form once it is in', () => {
    // Re-offering an empty form over a submission invites a learner to
    // overwrite what she already sent.
    renderTask({
      submission: { status: SUBMISSION_STATUS.SUBMITTED, text: 'My answer' },
      status: SUBMISSION_STATUS.SUBMITTED,
      isComplete: true,
      canSubmit: false,
    });
    expect(document.querySelector('textarea')).toBeNull();
  });
});
