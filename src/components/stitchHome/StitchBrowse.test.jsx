// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StitchBrowse from './StitchBrowse';
import { PROGRAMS } from '../../data/programTypes';

/**
 * Every programme card says what it is.
 *
 * Only one programme can be "next for you", so the rest of the catalogue fell
 * through to an empty badge. A learner enrolled in LEP alone saw LEP labelled
 * "Enrolled", 100BM labelled "Next for you", and MBW labelled nothing at all —
 * a blank corner between two filled ones, which reads as a card that failed to
 * load rather than one that is simply further off.
 */

const programme = (id, title, over) => ({
  id,
  title,
  description: `${title} blurb.`,
  meta: [],
  progressPct: 0,
  progressLabel: '',
  pending: 0,
  ctaLabel: 'Speak to our Counsellor',
  locked: true,
  state: 'locked',
  statusLabel: 'Locked',
  statusMessage: 'Not enrolled.',
  canOpenTasks: false,
  marketingUrl: '',
  href: '/app/support',
  ...over,
});

/** A learner in LEP only — the case that exposed the blank card. */
const DATA = {
  nav: { primary: [], footer: [] },
  learner: { name: 'Test Learner', role: 'Learner', initial: 'T' },
  catalogue: [
    programme(PROGRAMS.LEP, 'Leadership Essentials Program', {
      locked: false,
      state: 'open',
      statusLabel: 'Enrolled',
      canOpenTasks: true,
      ctaLabel: 'Open tasks',
    }),
    programme(PROGRAMS.BM100, '100 Board Members', {
      state: 'upcoming',
      statusLabel: 'Upcoming',
    }),
    programme(PROGRAMS.MBW, 'Master of Business Warfare'),
  ],
};

function renderBrowse(data = DATA) {
  return render(
    <MemoryRouter>
      <StitchBrowse data={data} onLogout={() => {}} />
    </MemoryRouter>
  );
}

const cards = () =>
  Array.from(document.querySelectorAll('.il-browse .rail .pcard')).map((el) => ({
    id: el.className.split(/\s+/)[1],
    pip: el.querySelector('.c-pip'),
  }));

afterEach(cleanup);

describe('the programme filmstrip labels every card', () => {
  it('leaves no card without a status', () => {
    renderBrowse();
    const found = cards();
    expect(found).toHaveLength(3);
    for (const card of found) {
      expect(card.pip, `${card.id} has no badge`).not.toBeNull();
      expect(card.pip.textContent.trim(), `${card.id} has a blank badge`).not.toBe('');
    }
  });

  it('names the three states from the access rules, not a vocabulary of its own', () => {
    renderBrowse();
    const byId = Object.fromEntries(cards().map((c) => [c.id, c.pip.textContent.trim()]));
    expect(byId[PROGRAMS.LEP]).toBe('Enrolled');
    expect(byId[PROGRAMS.BM100]).toBe('Next for you');
    // Neither enrolled nor the recommendation: it used to render nothing.
    expect(byId[PROGRAMS.MBW]).toBe('Locked');
  });

  it('keeps the two states the learner can act on louder than the rest', () => {
    renderBrowse();
    const byId = Object.fromEntries(cards().map((c) => [c.id, c.pip]));
    expect(byId[PROGRAMS.LEP].classList.contains('q')).toBe(false);
    expect(byId[PROGRAMS.BM100].classList.contains('q')).toBe(false);
    expect(byId[PROGRAMS.MBW].classList.contains('q')).toBe(true);
  });
});

describe('the page header', () => {
  it('states the headline once, on one line, with no caption under it', () => {
    renderBrowse();
    const header = document.querySelector('.il-browse .ph');
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Three programmes. Start anywhere.'
    );
    // A <br> would split it; a caption would add a paragraph.
    expect(header.querySelector('br')).toBeNull();
    expect(header.querySelector('p')).toBeNull();
  });

  it('still renders the catalogue under the header', () => {
    renderBrowse();
    expect(screen.getAllByLabelText('Master of Business Warfare').length).toBeGreaterThan(0);
  });
});
