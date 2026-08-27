// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistSubmission from './ChecklistSubmission';

/**
 * A checklist has no submit button on purpose — it saves on every tick, and the
 * task engine marks it complete once every box is ticked. That makes the ticks
 * the whole submission, so losing them loses the work.
 *
 * Which is what happened: state was initialised from `submission` once, but
 * submissions load after this mounts, so a learner returning to a part-finished
 * checklist saw every box empty with their real progress sitting behind it.
 */

afterEach(cleanup);

const TASK = {
  id: 'lep-orientation-framework',
  checklistItems: ['Read the framework', 'Know the live days', 'Know what is expected'],
};

describe('ChecklistSubmission', () => {
  it('saves on tick, with no submit button to press', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<ChecklistSubmission task={TASK} submission={null} canSubmit onSubmit={onSubmit} />);

    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();

    await userEvent.click(screen.getByLabelText(TASK.checklistItems[0]));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ checkedItems: [TASK.checklistItems[0]] }));
  });

  it('sends every ticked item, so the engine can see the checklist is finished', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<ChecklistSubmission task={TASK} submission={null} canSubmit onSubmit={onSubmit} />);

    for (const item of TASK.checklistItems) {
      await userEvent.click(screen.getByLabelText(item));
    }
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith({ checkedItems: TASK.checklistItems })
    );
    expect(screen.getByText(/3\/3 completed/)).toBeTruthy();
  });

  it('shows ticks that arrive after mount', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const { rerender } = render(
      <ChecklistSubmission task={TASK} submission={null} canSubmit onSubmit={onSubmit} />
    );
    expect(screen.getByLabelText(TASK.checklistItems[0]).checked).toBe(false);

    // The submission loads a moment later, as it does in the real page.
    rerender(
      <ChecklistSubmission
        task={TASK}
        submission={{ checkedItems: [TASK.checklistItems[0], TASK.checklistItems[1]] }}
        canSubmit
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByLabelText(TASK.checklistItems[0]).checked).toBe(true));
    expect(screen.getByLabelText(TASK.checklistItems[1]).checked).toBe(true);
    expect(screen.getByLabelText(TASK.checklistItems[2]).checked).toBe(false);
    expect(screen.getByText(/2\/3 completed/)).toBeTruthy();
  });

  it('does not undo a tick when the saved submission echoes it back', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const { rerender } = render(
      <ChecklistSubmission task={TASK} submission={null} canSubmit onSubmit={onSubmit} />
    );

    await userEvent.click(screen.getByLabelText(TASK.checklistItems[0]));
    // The parent re-renders with the value it just saved.
    rerender(
      <ChecklistSubmission
        task={TASK}
        submission={{ checkedItems: [TASK.checklistItems[0]] }}
        canSubmit
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByLabelText(TASK.checklistItems[0]).checked).toBe(true));
  });

  it('rolls the tick back and says so when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network down'));
    render(<ChecklistSubmission task={TASK} submission={null} canSubmit onSubmit={onSubmit} />);

    await userEvent.click(screen.getByLabelText(TASK.checklistItems[0]));

    await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
    expect(screen.getByLabelText(TASK.checklistItems[0]).checked).toBe(false);
  });

  it('cannot be ticked when the learner may not submit', async () => {
    const onSubmit = vi.fn();
    render(
      <ChecklistSubmission task={TASK} submission={null} canSubmit={false} onSubmit={onSubmit} />
    );
    expect(screen.getByLabelText(TASK.checklistItems[0]).disabled).toBe(true);
    await userEvent.click(screen.getByLabelText(TASK.checklistItems[0]));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
