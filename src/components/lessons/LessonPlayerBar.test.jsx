// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import LessonPlayerBar from './LessonPlayerBar';

/**
 * Fullscreen and Expand under the lesson player.
 *
 * jsdom has no fullscreen support, so the browser's answer is set per test. What
 * is pinned is when each control is offered, and that it does what it says.
 */

function allowFullscreen(element = null) {
  Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
  Object.defineProperty(document, 'fullscreenElement', { value: element, configurable: true });
}

afterEach(() => {
  cleanup();
  delete document.fullscreenEnabled;
  delete document.fullscreenElement;
});

const target = () => {
  const el = document.createElement('div');
  el.requestFullscreen = vi.fn(() => Promise.resolve());
  return { current: el };
};

describe('Expand', () => {
  it('asks the page to expand, and says whether it is on', () => {
    const onToggleExpand = vi.fn();
    const { rerender } = render(
      <LessonPlayerBar expanded={false} onToggleExpand={onToggleExpand} />
    );
    const button = screen.getByRole('button', { name: 'Expand lesson' });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    rerender(<LessonPlayerBar expanded onToggleExpand={onToggleExpand} />);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Fullscreen', () => {
  it('fills the screen with the player when the browser allows it', () => {
    allowFullscreen();
    const ref = target();
    render(<LessonPlayerBar fullscreenTarget={ref} onToggleExpand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(ref.current.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('is not offered where the browser cannot do it, as on iPhone Safari', () => {
    render(<LessonPlayerBar fullscreenTarget={target()} onToggleExpand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull();
  });

  it('is not offered when there is nothing to fill the screen with', () => {
    allowFullscreen();
    render(<LessonPlayerBar fullscreenTarget={null} onToggleExpand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull();
  });

  it('turns into Exit fullscreen once the player fills the screen', () => {
    allowFullscreen();
    const ref = target();
    render(<LessonPlayerBar fullscreenTarget={ref} onToggleExpand={vi.fn()} />);
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: ref.current,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });
});

describe('a document in the bar', () => {
  it('names the document and links to the PDF', () => {
    render(<LessonPlayerBar label="What CoDeSeF is" openUrl="/doc.pdf" onToggleExpand={vi.fn()} />);
    expect(screen.getByText('What CoDeSeF is')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open pdf/i }).getAttribute('href')).toBe('/doc.pdf');
  });
});

describe('Go to assignment', () => {
  it('takes the learner to their work when the page offers it', () => {
    const onJumpToWork = vi.fn();
    render(<LessonPlayerBar onToggleExpand={vi.fn()} onJumpToWork={onJumpToWork} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to assignment' }));
    expect(onJumpToWork).toHaveBeenCalledTimes(1);
  });

  it('is absent where there is no work to go to', () => {
    render(<LessonPlayerBar onToggleExpand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Go to assignment' })).toBeNull();
  });
});
