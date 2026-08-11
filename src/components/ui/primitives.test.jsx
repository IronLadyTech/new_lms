// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import EmptyState from './EmptyState';
import PageHeader from './PageHeader';
import SectionCard from './SectionCard';
import SkipLink from './SkipLink';
import DashboardSkeleton from './DashboardSkeleton';
import PasswordInput from './PasswordInput';
import OfflineBanner from './OfflineBanner';

/**
 * The shared primitives. Between them these render on nearly every screen, so a
 * regression here is a regression everywhere — which is exactly why they were
 * the wrong things to leave untested.
 */

afterEach(cleanup);

const Icon = (props) => <svg data-testid="icon" {...props} />;

describe('EmptyState', () => {
  it('announces itself so a screen reader hears why the page is empty', () => {
    render(<EmptyState title="No tickets yet" message="Raise one above." />);
    const region = screen.getByRole('status');
    expect(region.textContent).toContain('No tickets yet');
    expect(region.textContent).toContain('Raise one above.');
  });

  it('marks the icon decorative — the title carries the meaning', () => {
    const { container } = render(<EmptyState icon={Icon} title="Empty" />);
    expect(container.querySelector('.empty-state__icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('renders an optional action', () => {
    render(<EmptyState title="Empty" action={<button type="button">Try again</button>} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('omits absent parts rather than rendering empty elements', () => {
    const { container } = render(<EmptyState title="Only a title" />);
    expect(container.querySelector('.empty-state__message')).toBeNull();
    expect(container.querySelector('.empty-state__action')).toBeNull();
    expect(container.querySelector('.empty-state__icon')).toBeNull();
  });
});

describe('PageHeader', () => {
  it('renders the title as the page h1', () => {
    render(<PageHeader title="Help & support" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Help & support');
  });

  it('renders eyebrow, subtitle and actions when given', () => {
    render(
      <PageHeader
        eyebrow="Help"
        icon={Icon}
        title="Support"
        subtitle="Report an issue"
        actions={<button type="button">Refresh</button>}
      />
    );
    expect(screen.getByText('Help')).toBeDefined();
    expect(screen.getByText('Report an issue')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
  });

  it('renders exactly one h1 even with an eyebrow above it', () => {
    render(<PageHeader eyebrow="Account" title="Profile" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('SectionCard', () => {
  it('renders its children', () => {
    render(<SectionCard title="Your identity">inner content</SectionCard>);
    expect(screen.getByText('inner content')).toBeDefined();
  });

  it('titles the card at h2, below the page h1', () => {
    render(<SectionCard title="Preferences">x</SectionCard>);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Preferences');
  });

  it('omits the header entirely when there is no title or actions', () => {
    const { container } = render(<SectionCard>bare</SectionCard>);
    expect(container.querySelector('.section-card__header')).toBeNull();
    expect(screen.getByText('bare')).toBeDefined();
  });

  it('can render as a different element for correct document structure', () => {
    const { container } = render(
      <SectionCard as="article" title="T">
        x
      </SectionCard>
    );
    expect(container.querySelector('article')).not.toBeNull();
  });
});

describe('SkipLink', () => {
  it('points at the main landmark by default', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#main-content');
  });

  it('can target another landmark, e.g. the CX shell', () => {
    render(<SkipLink targetId="cx-main-content" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#cx-main-content');
  });

  it('has text a keyboard user can act on', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link').textContent).toMatch(/skip to main content/i);
  });
});

describe('DashboardSkeleton', () => {
  it('announces a busy state instead of looking like real content', () => {
    render(<DashboardSkeleton />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe('Loading dashboard');
  });
});

describe('PasswordInput', () => {
  const setup = () => render(<PasswordInput value="hunter2" onChange={() => {}} />);

  it('masks the value by default', () => {
    setup();
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
  });

  it('reveals and re-masks on toggle, and reports its state', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');

    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(hide);
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
  });

  it('passes autoComplete through so managers offer the right credential', () => {
    render(<PasswordInput value="" onChange={() => {}} autoComplete="new-password" />);
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
  });
});

describe('OfflineBanner', () => {
  it('stays hidden while online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
    vi.restoreAllMocks();
  });

  it('announces politely when offline, without stealing focus', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<OfflineBanner />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch(/offline/i);
    vi.restoreAllMocks();
  });
});
