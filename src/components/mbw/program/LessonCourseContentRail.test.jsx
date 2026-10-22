// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import LessonCourseContentRail from './LessonCourseContentRail';

/**
 * The course content panel's two headers.
 *
 * `variant="column"` is the LEP lesson column: lessons done and a progress bar,
 * modules and total time, and a button to hide the column. Every other page
 * (MBW, 100BM, the phone tab) gets the default header, which must stay exactly
 * as it was.
 */

afterEach(cleanup);

const PROPS = {
  completed: 15,
  total: 20,
  moduleCount: 11,
  modulesDone: 3,
  durationLabel: '8 Hr 55 mins',
};

describe('the course content column', () => {
  it('counts lessons done, as a readable bar', () => {
    render(<LessonCourseContentRail {...PROPS} variant="column" />);
    expect(screen.getByText('of 20 lessons', { exact: false })).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Course progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('75');
  });

  it('lists modules with their total time, and how many are done', () => {
    render(<LessonCourseContentRail {...PROPS} variant="column" />);
    expect(screen.getByText('11 modules · 8 Hr 55 mins')).toBeTruthy();
    expect(screen.getByText('3 of 11 modules')).toBeTruthy();
  });

  it('shows no time it was not given', () => {
    render(<LessonCourseContentRail {...PROPS} durationLabel="" variant="column" />);
    expect(screen.getByText('11 modules')).toBeTruthy();
    expect(screen.queryByText(/Hr/)).toBeNull();
  });

  it('can be hidden, when the page says how', () => {
    const onHide = vi.fn();
    render(<LessonCourseContentRail {...PROPS} variant="column" onHide={onHide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide course content' }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('offers no hide button when the page gives no way to bring it back', () => {
    render(<LessonCourseContentRail {...PROPS} variant="column" />);
    expect(screen.queryByRole('button', { name: 'Hide course content' })).toBeNull();
  });
});

describe('the default panel', () => {
  it('keeps its own header, as MBW and 100BM have it', () => {
    render(<LessonCourseContentRail {...PROPS} />);
    expect(document.querySelector('.lesson-course-rail__pct').textContent).toBe('75%');
    expect(screen.getByText('3 of 11 modules · 15/20 lessons · 8 Hr 55 mins')).toBeTruthy();
    expect(document.querySelector('.lesson-course-rail__progress')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide course content' })).toBeNull();
  });
});

describe('the course content filters', () => {
  const COUNTS = { all: 20, todo: 3, submitted: 5 };

  it('offers All, To do and Submitted, with counts, and marks the one in use', () => {
    render(
      <LessonCourseContentRail
        {...PROPS}
        variant="column"
        filter="all"
        onFilterChange={vi.fn()}
        filterCounts={COUNTS}
      />
    );
    const group = screen.getByRole('group', { name: 'Filter lessons' });
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['All20', 'To do3', 'Submitted5']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('asks for the filter picked', () => {
    const onFilterChange = vi.fn();
    render(
      <LessonCourseContentRail
        {...PROPS}
        variant="column"
        onFilterChange={onFilterChange}
        filterCounts={COUNTS}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Submitted/ }));
    expect(onFilterChange).toHaveBeenCalledWith('submitted');
  });

  it('shows no filters where the page does not ask for them', () => {
    render(<LessonCourseContentRail {...PROPS} variant="column" />);
    expect(screen.queryByRole('group', { name: 'Filter lessons' })).toBeNull();
  });
});
