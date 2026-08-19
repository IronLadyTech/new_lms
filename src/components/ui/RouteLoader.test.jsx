// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import RouteLoader from './RouteLoader';

/**
 * The loading screen.
 *
 * It replaced a skeleton that rendered as three grey bars floating in an empty
 * page, so the things worth pinning are the ones that made it wrong: it must
 * announce itself once rather than narrating every rotation, it must never show
 * a percentage it cannot know, and it must stop moving when the user has asked
 * the system to stop moving.
 */

function setReducedMotion(reduced) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduced,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('route loader · what it tells the user', () => {
  it('announces itself once, with the label it was given', () => {
    render(<RouteLoader label="Loading page" />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe('Loading page');
  });

  it('keeps the rotating text out of the accessibility tree', () => {
    /*
     * A new sentence every 1.6s inside a live region would talk over whatever
     * the user is doing. The aria-label above is the whole announcement.
     */
    const { container } = render(<RouteLoader />);
    const stage = container.querySelector('.route-loader__stage');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('never claims a percentage or a step count', () => {
    // Fake progress is the one thing this component must not invent.
    const { container } = render(<RouteLoader />);
    advance(1600 * 4);
    const text = container.textContent;
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/step\s*\d/i);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe('route loader · motion', () => {
  it('moves through every stage and returns to the first', () => {
    const { container } = render(<RouteLoader />);
    const line = () => container.querySelector('.route-loader__line').textContent;
    const first = line();
    const seen = new Set([first]);
    for (let i = 0; i < 3; i += 1) {
      advance(1600);
      seen.add(line());
    }
    expect(seen.size).toBe(4);
    advance(1600);
    expect(line()).toBe(first);
  });

  it('holds still when the user prefers reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(<RouteLoader />);
    const first = container.querySelector('.route-loader__line').textContent;
    advance(1600 * 5);
    expect(container.querySelector('.route-loader__line').textContent).toBe(first);
  });

  it('stops its timer on unmount', () => {
    // An interval left running after a route resolves keeps re-rendering a
    // component nobody can see.
    const { unmount, container } = render(<RouteLoader />);
    const before = container.querySelector('.route-loader__line').textContent;
    unmount();
    expect(() => advance(1600 * 3)).not.toThrow();
    expect(before).toBeTruthy();
  });
});
