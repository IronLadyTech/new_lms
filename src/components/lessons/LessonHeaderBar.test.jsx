// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LessonHeaderBar, { LESSON_HEADER_SLOT_ID } from './LessonHeaderBar';
import useMediaQuery from '../../hooks/useMediaQuery';

/**
 * Back and the course name in the app header, on a wide lesson page.
 *
 * The header slot is created per test; jsdom has no layout, so the width
 * question is answered by the mocked media query.
 */

vi.mock('../../hooks/useMediaQuery', () => ({ default: vi.fn() }));

let slot = null;

function addSlot() {
  slot = document.createElement('div');
  slot.id = LESSON_HEADER_SLOT_ID;
  document.body.appendChild(slot);
}

afterEach(() => {
  cleanup();
  slot?.remove();
  slot = null;
  vi.clearAllMocks();
});

const CRUMBS = [
  { label: 'Programs', href: '/app/home' },
  { label: 'Leadership Essentials Program', href: '/app/lep' },
  { label: 'Fill the CoDeSeF Sheet' },
];

const renderBar = (onBack = vi.fn()) =>
  render(
    <MemoryRouter>
      <LessonHeaderBar title="Leadership Essentials Program" onBack={onBack} crumbs={CRUMBS} />
    </MemoryRouter>
  );

describe('the lesson in the app header', () => {
  it('puts back and the course name in the header on a wide screen', () => {
    useMediaQuery.mockReturnValue(true);
    addSlot();
    renderBar();
    expect(slot.querySelector('.lesson-header-bar__title').textContent).toBe(
      'Leadership Essentials Program'
    );
    expect(slot.querySelector('button[aria-label="Back to program"]')).toBeTruthy();
  });

  it('goes back when back is pressed', () => {
    useMediaQuery.mockReturnValue(true);
    addSlot();
    const onBack = vi.fn();
    renderBar(onBack);
    fireEvent.click(screen.getByRole('button', { name: 'Back to program' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the breadcrumb trail for screen readers', () => {
    useMediaQuery.mockReturnValue(true);
    addSlot();
    renderBar();
    const trail = slot.querySelector('.sr-only');
    expect(trail.textContent).toContain('Programs');
    expect(trail.textContent).toContain('Fill the CoDeSeF Sheet');
  });

  it('stays out of the header on a narrow screen, where the lesson keeps its own bar', () => {
    useMediaQuery.mockReturnValue(false);
    addSlot();
    renderBar();
    expect(slot.textContent).toBe('');
  });

  it('renders nothing on a page without the header slot', () => {
    useMediaQuery.mockReturnValue(true);
    const { container } = renderBar();
    expect(container.textContent).toBe('');
  });
});
