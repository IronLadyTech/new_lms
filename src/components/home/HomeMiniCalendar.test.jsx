// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeMiniCalendar from './HomeMiniCalendar';

/** 15 March 2026 is a Sunday, so the month starts on a Sunday too — a good
 *  stress case for the Monday-first offset. */
const TODAY = new Date(2026, 2, 15);

function renderCal(events, today = TODAY) {
  return render(
    <MemoryRouter>
      <HomeMiniCalendar events={events} today={today} />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe('HomeMiniCalendar', () => {
  it('renders nothing when no event falls in the shown month', () => {
    const { container } = renderCal([{ id: 'a', date: '2026-04-02', type: 'class' }]);
    expect(container.innerHTML).toBe('');
  });

  it('renders one cell per day of the month', () => {
    const { container } = renderCal([{ id: 'a', date: '2026-03-10', type: 'class' }]);
    expect(container.querySelectorAll('.home-mini-cal__day')).toHaveLength(31);
  });

  it('offsets the first cell so the month starts on the right weekday', () => {
    // March 2026 starts on a Sunday: six blanks before it in a Mon-first grid.
    const { container } = renderCal([{ id: 'a', date: '2026-03-10', type: 'class' }]);
    expect(container.querySelectorAll('.home-mini-cal__blank')).toHaveLength(6);
  });

  it('dots only the days that carry events', () => {
    const { container } = renderCal([
      { id: 'a', date: '2026-03-10', type: 'class' },
      { id: 'b', date: '2026-03-12', type: 'deadline' },
    ]);
    const dotted = container.querySelectorAll('.home-mini-cal__day--has-events');
    expect(dotted).toHaveLength(2);
    expect(container.querySelectorAll('.home-mini-cal__dot--class')).toHaveLength(1);
    expect(container.querySelectorAll('.home-mini-cal__dot--deadline')).toHaveLength(1);
  });

  it('links a day with events to that date on the calendar', () => {
    renderCal([{ id: 'a', date: '2026-03-10', type: 'class' }]);
    const link = screen.getByRole('link', { name: /10 March 2026 — 1 event$/ });
    expect(link.getAttribute('href')).toBe('/app/calendar?date=2026-03-10');
  });

  it('leaves an empty day unlinked', () => {
    renderCal([{ id: 'a', date: '2026-03-10', type: 'class' }]);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('caps the dots at three but keeps the true count in the label', () => {
    const events = [1, 2, 3, 4, 5].map((n) => ({
      id: `e${n}`,
      date: '2026-03-10',
      type: 'class',
    }));
    const { container } = renderCal(events);
    expect(container.querySelectorAll('.home-mini-cal__dot')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /5 events$/ })).toBeTruthy();
  });

  it('marks today', () => {
    const { container } = renderCal([{ id: 'a', date: '2026-03-10', type: 'class' }]);
    const todayCell = container.querySelector('.home-mini-cal__day--today');
    expect(todayCell.textContent).toContain('15');
  });

  it('ignores events with no date', () => {
    const { container } = renderCal([
      { id: 'a', date: '2026-03-10', type: 'class' },
      { id: 'b', type: 'class' },
    ]);
    expect(container.querySelectorAll('.home-mini-cal__day--has-events')).toHaveLength(1);
  });

  it('falls back to the general dot for an unknown type', () => {
    const { container } = renderCal([{ id: 'a', date: '2026-03-10' }]);
    expect(container.querySelectorAll('.home-mini-cal__dot--general')).toHaveLength(1);
  });
});
