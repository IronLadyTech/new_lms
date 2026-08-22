// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const refreshMyAccess = vi.fn();
const refreshProfile = vi.fn();

vi.mock('../../services/zohoService', () => ({
  refreshMyAccess: (...args) => refreshMyAccess(...args),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ refreshProfile }),
}));

const { default: RefreshAccessButton } = await import('./RefreshAccessButton');

/**
 * "Just paid — why is this still locked?"
 *
 * The webhook usually unlocks within a second and a sweep catches the rest, but
 * the sweep is on a timer and the worst moment to wait for it is the minute
 * after paying. This button is what that person clicks instead of emailing
 * support, so the thing it must never do is make their situation look worse
 * than it is.
 */

beforeEach(() => {
  refreshMyAccess.mockReset().mockResolvedValue({ ok: true });
  refreshProfile.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('refresh access · what it does', () => {
  it('asks Zoho and then reloads the profile', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RefreshAccessButton />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(refreshMyAccess).toHaveBeenCalledTimes(1));
    // The profile reload matters on its own: the webhook or a sweep may have
    // already fixed things since the page was opened, which is exactly the
    // case this button exists for.
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('reloads the profile even when Zoho says no', async () => {
    refreshMyAccess.mockResolvedValue({ ok: false, reason: 'zoho-unreachable' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RefreshAccessButton />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
  });
});

describe('refresh access · what it must not do', () => {
  it('shows no error when the refresh fails', async () => {
    /*
     * The padlock is already the honest answer. An error banner on top of it
     * would read as "your payment failed", which is a different and much worse
     * claim than "nothing changed yet".
     */
    refreshMyAccess.mockResolvedValue(null);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<RefreshAccessButton />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    expect(container.querySelector('.alert-error')).toBeNull();
    expect(container.textContent).not.toMatch(/error|failed|sorry/i);
  });

  it('does not stay spent, so a learner can try again', async () => {
    // Zoho may simply not have caught up yet. A permanently disabled button
    // would leave them with nothing to do but wait.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RefreshAccessButton />);
    const btn = screen.getByRole('button');
    await user.click(btn);

    await waitFor(() => expect(btn).toHaveProperty('disabled', false));
    vi.advanceTimersByTime(5000);
    await waitFor(() => expect(btn.textContent).toMatch(/refresh/i));
  });

  it('cannot be fired twice while it is working', async () => {
    let release;
    refreshMyAccess.mockReturnValue(new Promise((r) => { release = r; }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RefreshAccessButton />);
    const btn = screen.getByRole('button');

    await user.click(btn);
    await waitFor(() => expect(btn).toHaveProperty('disabled', true));
    release({ ok: true });
    await waitFor(() => expect(refreshMyAccess).toHaveBeenCalledTimes(1));
  });

  it('survives an auth context with no refreshProfile', async () => {
    refreshProfile.mockImplementation(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RefreshAccessButton />);
    await expect(user.click(screen.getByRole('button'))).resolves.not.toThrow();
  });
});
