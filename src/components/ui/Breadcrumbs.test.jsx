// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

/**
 * Breadcrumbs are the only orientation cue in a four-level hierarchy
 * (programme → section → lesson → submission). The current page must be
 * announced as current and must not be a link.
 */

afterEach(cleanup);

const renderCrumbs = (items) =>
  render(
    <MemoryRouter>
      <Breadcrumbs items={items} />
    </MemoryRouter>
  );

const TRAIL = [
  { label: 'MBW', href: '/app/mbw' },
  { label: 'Pre-Preparation', href: '/app/mbw?section=pre' },
  { label: 'The 27 Principles' },
];

describe('Breadcrumbs', () => {
  it('exposes itself as a labelled navigation landmark', () => {
    renderCrumbs(TRAIL);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
  });

  it('links every ancestor', () => {
    renderCrumbs(TRAIL);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['MBW', 'Pre-Preparation']);
  });

  it('marks the last item as the current page and does not link it', () => {
    renderCrumbs(TRAIL);
    const current = screen.getByText('The 27 Principles');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.tagName).not.toBe('A');
  });

  it('uses an ordered list — the trail is a sequence, not a set', () => {
    const { container } = renderCrumbs(TRAIL);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders an ancestor without an href as plain text', () => {
    renderCrumbs([{ label: 'Orphan' }, { label: 'Here' }]);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders nothing when there is no trail', () => {
    const { container } = renderCrumbs([]);
    expect(container.firstChild).toBeNull();
  });

  it('hides separators from screen readers', () => {
    const { container } = renderCrumbs(TRAIL);
    const seps = container.querySelectorAll('.breadcrumbs__sep');
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });
});
