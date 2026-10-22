// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100TaskContent from './BM100TaskContent';
import { TASK_TYPES, SUBMISSION_STATUS } from '../../services/mbwService';

/**
 * Editing and resubmitting a LEP hand-in, and its version history.
 *
 * A learner can edit what they handed in until their facilitator starts
 * reviewing it. v1 stays their submission until they resubmit, and every
 * version is listed. None of this reaches a lesson without the LEP context.
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
  sectionLabel: 'Day 2 · Strategies and Tactics',
  position: { index: 3, total: 6 },
  onBack: () => {},
};

const answer = (mattersToYou = 'Trust') => ({
  templateId: 'key-relationships',
  fields: {
    relationships: [{ relationship: 'Manager', mattersToYou, mattersToThem: 'Delivery' }],
  },
});

const V1 = { version: 1, submittedAt: '2026-09-14T19:52:00+05:30', data: { templateData: answer() } };
const V2 = {
  version: 2,
  submittedAt: '2026-09-15T10:05:00+05:30',
  data: { templateData: answer('Trust and time') },
};

const handedIn = (over = {}) => ({
  task: {
    id: 'lep-day2-relationships',
    title: 'Maximise Key Relationships',
    description: 'Identify your key relationships.',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'key-relationships',
    phase: 'day-2',
  },
  submission: {
    status: SUBMISSION_STATUS.SUBMITTED,
    submittedAt: V1.submittedAt,
    templateData: answer(),
  },
  status: SUBMISSION_STATUS.SUBMITTED,
  watched: true,
  canSubmit: false,
  canEdit: true,
  isComplete: true,
  versions: [V1],
  prevTaskId: null,
  ...over,
});

const renderLesson = (taskState, lessonContext = CONTEXT) =>
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

const lockedCells = () => [...document.querySelectorAll('.lesson-work textarea')];

describe('handed-in work, before review starts', () => {
  it('shows the same worksheet, locked, with a way to edit it', () => {
    renderLesson(handedIn());
    expect(document.querySelector('.mbw-form-template--locked')).not.toBeNull();
    expect(document.querySelector('.mbw-errc__table')).not.toBeNull();
    const cells = lockedCells();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell.readOnly)).toBe(true);
    expect(cells.some((cell) => cell.value === 'Manager')).toBe(true);
    expect(screen.queryByRole('button', { name: /Submit relationship map/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit submission' })).toBeTruthy();
    expect(
      screen.getByText('You can edit and resubmit until your facilitator starts reviewing.')
    ).toBeTruthy();
  });

  it('opens the form on Edit, and says v1 stays until the learner resubmits', () => {
    renderLesson(handedIn());
    fireEvent.click(screen.getByRole('button', { name: 'Edit submission' }));
    expect(document.querySelector('.mbw-form-template--locked')).toBeNull();
    expect(lockedCells().every((cell) => !cell.readOnly)).toBe(true);
    expect(
      screen.getByText(
        'v1 stays as your submitted version until you resubmit. Changes save as a draft on this device.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Editing v2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Resubmit as v2' }).disabled).toBe(true);
  });

  it('marks a change and lets the learner resubmit it', () => {
    renderLesson(handedIn());
    fireEvent.click(screen.getByRole('button', { name: 'Edit submission' }));
    const cell = screen.getAllByLabelText(
      'Relationship 1 — Things that matter to you in this relationship'
    )[0];
    fireEvent.change(cell, { target: { value: 'Trust and time' } });
    expect(cell.className).toContain('is-changed');
    expect(screen.getByRole('button', { name: 'Resubmit as v2' }).disabled).toBe(false);
  });

  it('saves a draft, and says so at the top of the panel', () => {
    renderLesson(handedIn());
    fireEvent.click(screen.getByRole('button', { name: 'Edit submission' }));
    expect(document.querySelector('.lesson-work__draft')).toBeNull();
    fireEvent.change(
      screen.getAllByLabelText('Relationship 1 — Things that matter to you in this relationship')[0],
      { target: { value: 'Trust and time' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    const note = document.querySelector('.lesson-work__head .lesson-work__draft');
    expect(note?.textContent).toBe('Draft saved on this device · just now');
    /* Once something is kept, the history line says so. */
    expect(screen.getByText('Draft v2 started')).toBeTruthy();
    expect(window.localStorage.getItem('lep-draft:u1:lep-day2-relationships')).toContain(
      'Trust and time'
    );
  });

  it('reopens an edit left as a draft on this device', () => {
    window.localStorage.setItem(
      'lep-draft:u1:lep-day2-relationships',
      JSON.stringify({
        fields: answer('Draft answer').fields,
        savedAt: new Date().toISOString(),
      })
    );
    renderLesson(handedIn());
    expect(screen.getByText('You’re editing your submission.')).toBeTruthy();
    expect(
      screen.getAllByLabelText('Relationship 1 — Things that matter to you in this relationship')[0]
        .value
    ).toBe('Draft answer');
    expect(document.querySelector('.lesson-work__draft')).not.toBeNull();
  });

  it('goes back to the submitted version on Discard changes', () => {
    renderLesson(handedIn());
    fireEvent.click(screen.getByRole('button', { name: 'Edit submission' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(document.querySelector('.mbw-form-template--locked')).not.toBeNull();
    expect(document.querySelector('.lesson-work__draft')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit submission' })).toBeTruthy();
  });
});

describe('once the facilitator starts reviewing', () => {
  it('says so, and offers no edit', () => {
    renderLesson(
      handedIn({
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        canEdit: false,
        submission: { ...handedIn().submission, status: SUBMISSION_STATUS.UNDER_REVIEW },
      })
    );
    expect(
      screen.getByText('Your facilitator is reviewing this, so it can’t be edited now.')
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit submission' })).toBeNull();
  });
});

describe('version history', () => {
  it('lists every version in order, and labels the latest', () => {
    renderLesson(
      handedIn({
        versions: [V1, V2],
        submission: {
          status: SUBMISSION_STATUS.SUBMITTED,
          submittedAt: V2.submittedAt,
          templateData: V2.data.templateData,
        },
      })
    );
    const items = [...document.querySelectorAll('.lesson-history__item strong')].map(
      (el) => el.textContent
    );
    expect(items).toEqual(['v1 submitted', 'v2 resubmitted']);
    expect(document.querySelector('.lesson-work__version').textContent).toBe('v2');
    expect(document.querySelector('.lesson-work__when').textContent).toMatch(/^Resubmitted 15 Sep/);
  });
});

describe('a lesson without the LEP context', () => {
  it('gets no edit button or version history', () => {
    renderLesson(handedIn(), null);
    expect(screen.queryByRole('button', { name: 'Edit submission' })).toBeNull();
    expect(document.querySelector('.lesson-history')).toBeNull();
  });
});
