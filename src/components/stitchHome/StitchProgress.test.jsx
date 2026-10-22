// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StitchProgress from './StitchProgress';
import { PROGRAMME_POSTER, posterMetaFor } from './ProgrammePoster';

/**
 * How much of a programme is on screen at once.
 *
 * Listing every module put 25 rows on this page — 5.7 phone screens — of which
 * three could be acted on. Everything past a short look ahead folds. The live
 * module never folds: it is the answer the page exists to give, and hiding it
 * behind a click would be worse than the length.
 */

const mod = (n, state, over = {}) => ({
  id: `m${n}`,
  n,
  title: `Module ${n}`,
  state,
  done: 0,
  total: 4,
  pct: 0,
  why: state === 'locked' ? `Opens after module ${n - 1}` : '',
  next: null,
  ...over,
});

function programme(modules) {
  return {
    id: 'lep',
    code: 'LEP',
    name: 'Leadership Essentials Program',
    color: '#F5B301',
    total: modules.length,
    modules,
    tasksPath: '/app/lep',
  };
}

function renderPage(modules) {
  return render(
    <MemoryRouter>
      <StitchProgress
        data={{
          nav: { primary: [], footer: [] },
          learner: { name: 'Test Learner', role: 'Learner', initial: 'T' },
          progress: {
            programmes: [programme(modules)],
            activity: { byDate: {}, todayIso: '2026-09-09', fourWeeks: [], note: '' },
          },
        }}
        onLogout={() => {}}
      />
    </MemoryRouter>
  );
}

const openRows = () => document.querySelectorAll('.il-learning .lstack > .lrow');
const foldLabels = () =>
  Array.from(document.querySelectorAll('.il-learning .lfold-h')).map((b) => b.textContent.trim());

/** Twelve modules: one done, one live, ten ahead. */
const MANY = [
  mod(1, 'done', { done: 4, pct: 100 }),
  mod(2, 'live', {
    done: 2,
    pct: 50,
    next: { title: 'Maximise Key Relationships', kind: 'Written task', cta: 'Resume', href: '/x' },
  }),
  ...Array.from({ length: 10 }, (_, i) => mod(i + 3, 'locked')),
];

afterEach(cleanup);

describe('a programme shows the work in front of her, not all of it', () => {
  it('opens with the live module and a short look ahead', () => {
    renderPage(MANY);
    expect(openRows()).toHaveLength(3);
    expect(screen.getByText('Module 2')).toBeTruthy();
  });

  it('keeps the live module out of the fold however many are ahead', () => {
    renderPage(MANY);
    const first = openRows()[0];
    expect(first.className).not.toMatch(/idle/);
    expect(first.textContent).toContain('Module 2');
  });

  it('says how many it is holding back, in two separate shelves', () => {
    renderPage(MANY);
    // ten ahead, two of them shown; one done
    expect(foldLabels()).toEqual(['8 more modules ahead', '1 completed module']);
  });

  it('reveals the rest when asked', async () => {
    renderPage(MANY);
    await userEvent.click(screen.getByRole('button', { name: /8 more modules ahead/ }));
    expect(document.querySelectorAll('.il-learning .lfold.open .lrow')).toHaveLength(8);
  });

  it('does not fold a programme that already fits', () => {
    renderPage([mod(1, 'live', { done: 1, pct: 25 }), mod(2, 'locked')]);
    expect(openRows()).toHaveLength(2);
    expect(foldLabels()).toEqual([]);
  });

  it('still names the full length of the programme', () => {
    renderPage(MANY);
    expect(screen.getByText('12 modules')).toBeTruthy();
  });
});

describe('an opened shelf can be closed from where it ends', () => {
  it('offers the way back at the foot of what it opened', async () => {
    renderPage(MANY);
    // Nine rows in, the header that opened this is long out of reach.
    await userEvent.click(screen.getByRole('button', { name: /8 more modules ahead/ }));
    const back = document.querySelector('.il-learning .lfold.open .lfold-f');
    expect(back).toBeTruthy();
    expect(back.textContent).toMatch(/show less/i);
  });

  it('closes the shelf it belongs to', async () => {
    renderPage(MANY);
    await userEvent.click(screen.getByRole('button', { name: /8 more modules ahead/ }));
    expect(document.querySelectorAll('.il-learning .lfold.open')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(document.querySelectorAll('.il-learning .lfold.open')).toHaveLength(0);
  });

  it('brings the shelf header back into view rather than leaving her adrift', async () => {
    // The rows vanish from under the viewport, so without this she lands
    // wherever the shortened page puts her — measured at 347px above the top.
    // jsdom implements no scrolling at all, so there is nothing to spy on yet.
    Element.prototype.scrollIntoView = () => {};
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    renderPage(MANY);
    await userEvent.click(screen.getByRole('button', { name: /8 more modules ahead/ }));
    spy.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /show less/i }));
    // jsdom fires no transitionend, so this exercises the fallback timer.
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 1500 });
    expect(spy.mock.calls[0][0]).toEqual({ block: 'nearest' });
    spy.mockRestore();
  });

  it('keeps a closed shelf out of the tab order and the reading order', () => {
    renderPage(MANY);
    const shut = document.querySelector('.il-learning .lfold:not(.open)');
    expect(shut.querySelector('.lfold-f').tabIndex).toBe(-1);
    expect(shut.querySelector('.lfold-b').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('a programme looks the same here as everywhere else', () => {
  it('draws the shared poster, not a heading of its own invention', () => {
    // It used to be a 30px square with the code lettered on it — a third
    // likeness for a programme that already had one on the dashboard and one on
    // Browse Courses.
    renderPage(MANY);
    const art = document.querySelector('.il-learning .lgrp-art .il-poster');
    expect(art).toBeTruthy();
    expect(art.classList.contains('il-poster--sm')).toBe(true);
    expect(art.querySelector('.il-poster__tag').textContent).toBe('LEP');
  });

  it('uses the dashboard’s primary button rather than a second 3D treatment', () => {
    renderPage(MANY);
    const btn = screen.getByRole('button', { name: 'Resume' });
    expect(btn.classList.contains('sh-btn-primary')).toBe(true);
    // .lbtn is layout only; anything it set that sh-btn-primary also sets would
    // be a coin toss decided by stylesheet order.
    expect(btn.classList.contains('lbtn')).toBe(true);
  });

  it('takes its wording from the one shared table', () => {
    renderPage(MANY);
    const lines = Array.from(
      document.querySelectorAll('.il-learning .lgrp-art .il-poster__line')
    ).map((el) => el.textContent);
    expect(lines).toEqual(PROGRAMME_POSTER.lep.nameLines);
  });

  it('knows all three programmes by their real ids', () => {
    // '100bm', not 'bm100' — keyed wrongly this silently falls back.
    expect(Object.keys(PROGRAMME_POSTER).sort()).toEqual(['100bm', 'lep', 'mbw']);
    for (const meta of Object.values(PROGRAMME_POSTER)) {
      expect(meta.nameLines.length).toBeGreaterThan(0);
      expect(meta.code).toBeTruthy();
    }
  });

  it('falls back to the programme’s own title rather than an empty card', () => {
    const meta = posterMetaFor('something-new', 'Brand New Programme');
    expect(meta.nameLines).toEqual(['Brand', 'New', 'Programme']);
    expect(meta.code).toBe('BRAND ');
  });
});
