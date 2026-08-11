// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Tooltip from './Tooltip';

/**
 * Tooltip replaced ~109 native `title` attributes, which are invisible on touch
 * and unreachable by keyboard. These tests hold it to the three things `title`
 * could not do: appear on focus, describe its trigger, and dismiss on Escape
 * (WCAG 1.4.13).
 */

afterEach(cleanup);

const setup = (label = 'Assign & reply to issues') =>
  render(
    <Tooltip label={label}>
      <button type="button">Tickets</button>
    </Tooltip>
  );

describe('Tooltip', () => {
  it('stays hidden until hover or focus', () => {
    setup();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('appears on hover', () => {
    const { container } = setup();
    fireEvent.mouseEnter(container.firstChild);
    expect(screen.getByRole('tooltip').textContent).toBe('Assign & reply to issues');
  });

  it('appears on keyboard focus — the case native title never handled', () => {
    setup();
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('associates the tooltip with its trigger via aria-describedby', () => {
    setup();
    fireEvent.focus(screen.getByRole('button'));

    const tooltip = screen.getByRole('tooltip');
    const describer = document.querySelector(`[aria-describedby="${tooltip.id}"]`);
    expect(describer).not.toBeNull();
    expect(describer.contains(screen.getByRole('button'))).toBe(true);
  });

  it('dismisses on Escape and leaves focus on the trigger (WCAG 1.4.13)', () => {
    const { container } = setup();
    const trigger = screen.getByRole('button');

    // Move real DOM focus, not just the synthetic event — the point of the
    // requirement is that dismissing costs the user nothing.
    trigger.focus();
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeDefined();

    fireEvent.keyDown(container.firstChild, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('re-opens after a dismiss once focus leaves and returns', () => {
    const { container } = setup();
    fireEvent.focus(screen.getByRole('button'));
    fireEvent.keyDown(container.firstChild, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.blur(screen.getByRole('button'));
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('renders the child untouched when there is no label', () => {
    render(
      <Tooltip label="">
        <button type="button">Bare</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: 'Bare' })).toBeDefined();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
