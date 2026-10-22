// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100TaskContent from './BM100TaskContent';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * Every kind of LEP hand-in, side by side.
 *
 * What a learner can do with work already sent depends on what they sent: a
 * worksheet, a written answer and a link can all be reopened and kept as a
 * draft; a file can be reopened but not drafted, because the browser cannot
 * keep a chosen file; a checklist is ticked, not handed in, so it has neither.
 */

vi.mock('../../hooks/useLessonAsset', () => ({
  useLessonAsset: () => ({ url: '', loading: false, reason: null }),
}));
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => true }));
vi.mock('../lessons/LessonDocument', () => ({ default: () => <div /> }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const CONTEXT = {
  programTitle: 'Leadership Essentials Program',
  sectionLabel: 'Pre-Program Preparation',
  position: { index: 1, total: 3 },
  onBack: () => {},
};

const V1 = { version: 1, submittedAt: '2026-09-14T19:52:00+05:30', data: {} };

const state = (task, submission, over = {}) => ({
  task: { id: 'lep-task', title: 'A hand-in', description: 'Do it.', phase: 'pre-program', ...task },
  submission: { status: SUBMISSION_STATUS.SUBMITTED, submittedAt: V1.submittedAt, ...submission },
  status: SUBMISSION_STATUS.SUBMITTED,
  watched: true,
  canSubmit: false,
  canEdit: true,
  isComplete: true,
  versions: [V1],
  prevTaskId: null,
  ...over,
});

const renderLesson = (taskState) =>
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
        lessonContext={CONTEXT}
      />
    </MemoryRouter>
  );

const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit submission' }));

describe('a written answer', () => {
  const written = () =>
    state({ type: TASK_TYPES.TEXT }, { textValue: 'My first answer' });

  it('can be reopened, and keeps what was sent', () => {
    renderLesson(written());
    edit();
    expect(screen.getByRole('textbox').value).toBe('My first answer');
    expect(screen.getByRole('button', { name: 'Resubmit as v2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeTruthy();
  });

  it('keeps a draft on this device, and says so', () => {
    renderLesson(written());
    edit();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A better answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(document.querySelector('.lesson-work__draft')?.textContent).toBe(
      'Draft saved on this device · just now'
    );
    expect(window.localStorage.getItem('lep-draft:u1:lep-task')).toContain('A better answer');
  });

  it('reopens into that draft next time', () => {
    window.localStorage.setItem(
      'lep-draft:u1:lep-task',
      JSON.stringify({ fields: { text: 'Half-written' }, savedAt: new Date().toISOString() })
    );
    renderLesson(written());
    expect(screen.getByText('You’re editing your submission.')).toBeTruthy();
    expect(screen.getByRole('textbox').value).toBe('Half-written');
  });
});

describe('a link', () => {
  const link = () =>
    state({ type: TASK_TYPES.LINK }, { linkValue: 'https://example.com/one' });

  it('can be reopened and drafted', () => {
    renderLesson(link());
    edit();
    const field = document.querySelector('.lesson-work input[type="url"]');
    expect(field.value).toBe('https://example.com/one');
    fireEvent.change(field, { target: { value: 'https://example.com/two' } });
    expect(window.localStorage.getItem('lep-draft:u1:lep-task')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resubmit as v2' })).toBeTruthy();
  });
});

describe('an uploaded file', () => {
  const upload = () =>
    state({ type: TASK_TYPES.FILE_UPLOAD }, { fileName: 'report.pdf', fileUrl: '/f/report.pdf' });

  it('can be reopened, with no draft offered — a file cannot be kept here', () => {
    renderLesson(upload());
    edit();
    expect(screen.getByRole('button', { name: 'Resubmit as v2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.getByText('Editing v2')).toBeTruthy();
  });
});

describe('a checklist', () => {
  it('is ticked rather than handed in, so nothing is offered to edit', () => {
    /* The engine never marks a checklist editable; the lesson follows suit. */
    renderLesson(
      state({ type: TASK_TYPES.CHECKLIST, checklistItems: ['I have read it'] }, { checkedItems: [0] }, {
        canEdit: false,
      })
    );
    expect(screen.queryByRole('button', { name: 'Edit submission' })).toBeNull();
    expect(document.querySelector('.lesson-work__banner')).toBeNull();
  });
});
