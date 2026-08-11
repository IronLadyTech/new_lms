// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CxKpiStrip from '../cx/CxKpiStrip';

/**
 * The KPI strip encodes a deliberate rule: a tile is either read-only or it
 * navigates to the queue that clears it — never ambiguously both. These tests
 * pin that rule, because a tile that looks clickable and isn't (or vice versa)
 * is the kind of regression nobody notices until staff stop trusting the number.
 */

afterEach(cleanup);

const renderStrip = (props) =>
  render(
    <MemoryRouter>
      <CxKpiStrip {...props} />
    </MemoryRouter>
  );

describe('CxKpiStrip', () => {
  it('renders a read-only tile as plain text, not a control', () => {
    renderStrip({ items: [{ id: 'p', label: 'Participants', value: 42 }] });

    expect(screen.getByText('42')).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a tile with a destination as a link', () => {
    renderStrip({
      items: [{ id: 'a', label: 'Needs attention', value: 47, to: '/cx/reviews' }],
    });

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/cx/reviews');
    expect(within(link).getByText('47')).toBeDefined();
  });

  it('renders a tile with a handler as a button', () => {
    renderStrip({ items: [{ id: 'a', label: 'Open', value: 3, onClick: () => {} }] });
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('shows the real value, never a truncated preview count', () => {
    // Regression guard: the attention tile once reported a capped 8 against a
    // real backlog of 47, because the slice ran before the count was taken.
    renderStrip({ items: [{ id: 'a', label: 'Needs attention', value: 47 }] });
    expect(screen.getByText('47')).toBeDefined();
    expect(screen.queryByText('8')).toBeNull();
  });

  it('renders skeletons while loading and no stale values', () => {
    const { container } = renderStrip({
      items: [{ id: 'a', label: 'Participants', value: 42 }],
      loading: true,
    });

    expect(container.querySelectorAll('.cx-kpi--skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('42')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders nothing when there are no items', () => {
    const { container } = renderStrip({ items: [] });
    expect(container.firstChild).toBeNull();
  });

  it('marks the icon decorative so screen readers read the value, not the glyph', () => {
    const Icon = () => <svg data-testid="icon" />;
    const { container } = renderStrip({
      items: [{ id: 'a', label: 'Participants', value: 1, icon: Icon }],
    });
    expect(container.querySelector('.cx-kpi__icon').getAttribute('aria-hidden')).toBe('true');
  });
});
