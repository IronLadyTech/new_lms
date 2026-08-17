// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LessonSearchDialog from './LessonSearchDialog';
import { getModuleLabel } from '../../utils/mbwDisplay';

/*
 * The dialog passes a taskState to getTaskLabel, while getModuleLabel takes the
 * task inside it. Handing getModuleLabel over directly made every row read
 * "Module 1 — undefined", and because the same label is what the query is
 * matched against, typing anything returned nothing. These cover the label and
 * the filtering separately, since the label looking right does not prove the
 * search works.
 */
const taskStates = [
  { task: { id: 'a', order: 0, title: 'Orientation Session', phase: 'pre' } },
  { task: { id: 'b', order: 1, title: 'Resume Review', phase: 'pre' } },
  { task: { id: 'c', order: 2, title: 'C-Suite Talk', phase: 'q2' } },
];

/** What the programme pages hand the dialog. */
const lessonSearchLabel = (ts) => getModuleLabel(ts?.task ?? ts);

function renderDialog(props = {}) {
  return render(
    <LessonSearchDialog
      open
      onClose={() => {}}
      onSelect={() => {}}
      taskStates={taskStates}
      getTaskLabel={lessonSearchLabel}
      {...props}
    />
  );
}

afterEach(cleanup);

describe('LessonSearchDialog', () => {
  it('labels each lesson with its own module number and title', () => {
    renderDialog();

    expect(
      screen.getAllByText(/^Module \d+ — /).map((el) => el.textContent)
    ).toEqual([
      'Module 1 — Orientation Session',
      'Module 2 — Resume Review',
      'Module 3 — C-Suite Talk',
    ]);
  });

  it('never renders a label built from a missing title', () => {
    renderDialog();
    expect(screen.queryByText(/undefined/i)).toBeNull();
  });

  it('filters to the matching lesson as the learner types', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Lesson name or section'), 'resume');

    expect(screen.getAllByText(/^Module \d+ — /).map((el) => el.textContent)).toEqual([
      'Module 2 — Resume Review',
    ]);
  });

  it('reports no matches for a query nothing satisfies', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Lesson name or section'), 'zzzzz');

    expect(screen.queryAllByText(/^Module \d+ — /)).toHaveLength(0);
  });

  it('returns the selected task id to the caller', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderDialog({ onSelect });

    await user.click(screen.getByText('Module 2 — Resume Review'));

    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
