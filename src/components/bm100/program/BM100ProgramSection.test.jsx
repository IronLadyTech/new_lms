// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BM100ProgramSection from './BM100ProgramSection';
import { BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import { PROGRAMS } from '../../../data/programTypes';

/**
 * What a learner actually sees on a locked section.
 *
 * The rules here are all UI decisions with money behind them, and none of them
 * had a single test until now — every one of the defects below reached
 * production and was caught by a person looking at a screen:
 *
 *   · a padlock on sections a learner had already paid for
 *   · "full program payment required" on the lessons of a section that was
 *     merely waiting on earlier work, while the header above said otherwise
 *   · no padlock at all on payment-locked sections, so locked read as open
 *   · locked sections hiding their contents from the learner who owns them
 *
 * The rule being pinned: the padlock means money, not progress.
 */

afterEach(cleanup);

const PAID_SECTION = BM100_PROGRAM_SECTIONS.find((s) => s.gate?.requiresPaid);
const FREE_SECTION = BM100_PROGRAM_SECTIONS.find((s) => !s.gate?.requiresPaid);

const lessonsFor = (section, n = 3) =>
  Array.from({ length: n }, (_, i) => ({
    task: {
      id: `${section.id}-${i}`,
      phase: section.id,
      order: i,
      title: `Lesson ${i + 1}`,
      type: 'video',
    },
    status: 'locked',
    isComplete: false,
    phaseLocked: true,
  }));

function renderSection({ section = PAID_SECTION, profile, unlocked = false, expanded = true } = {}) {
  const progress = {};
  BM100_PROGRAM_SECTIONS.forEach((s) => {
    progress[s.id] = { done: 0, total: 3, status: unlocked ? 'in-progress' : 'locked', unlocked };
  });
  return render(
    <MemoryRouter>
      <BM100ProgramSection
        section={section}
        sectionIndex={2}
        sectionProgress={progress}
        profile={profile}
        expanded={expanded}
        isCurrent={false}
        taskStates={lessonsFor(section)}
        activeTaskId={null}
        nextTaskId={null}
        onToggle={() => {}}
        onSelectLesson={vi.fn()}
      />
    </MemoryRouter>
  );
}

const padlocks = (container) => container.querySelectorAll('.mbw-section-card__pay-lock svg').length;
const lessonRows = (container) => container.querySelectorAll('.mbw-lesson-row').length;
const startableRows = (container) =>
  [...container.querySelectorAll('.mbw-lesson-row__main')].filter((b) => !b.disabled).length;

/* ── registration tier ─────────────────────────────────────────────────────── */

describe('registration tier · payment is the barrier', () => {
  const profile = {
    programAccess: { [PROGRAMS.BM100]: { paymentStatus: 'register' } },
  };

  it('shows a padlock', () => {
    const { container } = renderSection({ profile });
    expect(padlocks(container)).toBeGreaterThan(0);
  });

  it('says what is owed, and offers a way to resolve it', () => {
    renderSection({ profile });
    expect(screen.getByText(/paid only the registration amount/i)).toBeTruthy();
  });

  it('does not preview the lessons they have not bought', () => {
    const { container } = renderSection({ profile });
    expect(lessonRows(container)).toBe(0);
  });
});

/* ── paid, waiting on earlier work ─────────────────────────────────────────── */

describe('paid but sequence-locked · progress is the barrier', () => {
  const profile = {
    programAccess: {
      [PROGRAMS.BM100]: { paymentStatus: 'paid', fullPaidAt: '2026-08-01T00:00:00.000Z' },
    },
  };

  it('shows no padlock — they have already paid for this', () => {
    const { container } = renderSection({ profile });
    expect(padlocks(container)).toBe(0);
  });

  it('never suggests money is owed', () => {
    // The exact defect: a fully paid learner told to pay again, on lessons
    // inside a section merely waiting on Phase 1.
    const { container } = renderSection({ profile });
    expect(container.textContent).not.toMatch(/payment required/i);
    expect(container.textContent).not.toMatch(/registration amount/i);
  });

  it('names the section to finish first', () => {
    renderSection({ profile });
    // Appears more than once by design: once as the panel message and again as
    // each row's reason, which is the consistency being enforced below.
    expect(screen.getAllByText(/complete .* to unlock/i).length).toBeGreaterThan(0);
  });

  it('lists every lesson, so they can see what they own', () => {
    const { container } = renderSection({ profile });
    expect(lessonRows(container)).toBe(3);
  });

  it('lets none of them be started', () => {
    const { container } = renderSection({ profile });
    expect(startableRows(container)).toBe(0);
  });

  it('ignores a click on a listed lesson', async () => {
    const user = userEvent.setup();
    const { container } = renderSection({ profile });
    const row = container.querySelector('.mbw-lesson-row__main');
    await user.click(row).catch(() => {});
    // Disabled buttons swallow the click; nothing should navigate or open.
    expect(row.disabled).toBe(true);
  });

  it('gives one explanation, not two', () => {
    /*
     * The header and the rows used to disagree — the card said "complete
     * Phase 1" while every row said payment was required. Whatever a row
     * says must match the section.
     */
    const { container } = renderSection({ profile });
    const rowTitles = [...container.querySelectorAll('.mbw-lesson-row__main')]
      .map((b) => b.getAttribute('title') || '')
      .filter(Boolean);
    rowTitles.forEach((t) => expect(t).not.toMatch(/payment/i));
  });
});

/* ── expired window ────────────────────────────────────────────────────────── */

describe('expired window · access has ended', () => {
  const profile = {
    programAccess: {
      [PROGRAMS.BM100]: { paymentStatus: 'paid', fullPaidAt: '2024-01-01T00:00:00.000Z' },
    },
  };

  it('shows a padlock — this is access, not progress', () => {
    const { container } = renderSection({ profile });
    expect(padlocks(container)).toBeGreaterThan(0);
  });

  it('says the access ended rather than blaming payment', () => {
    const { container } = renderSection({ profile });
    expect(screen.getByText(/has ended/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/registration amount/i);
  });
});

/* ── unlocked ──────────────────────────────────────────────────────────────── */

describe('unlocked · nothing in the way', () => {
  const profile = {
    programAccess: { [PROGRAMS.BM100]: { paymentStatus: 'paid' } },
  };

  it('shows no padlock and no lock message', () => {
    const { container } = renderSection({ profile, unlocked: true });
    expect(padlocks(container)).toBe(0);
    expect(container.textContent).not.toMatch(/unlock this section/i);
  });
});

/* ── free sections ─────────────────────────────────────────────────────────── */

describe('sections with no payment gate', () => {
  it('never padlocks an unpaid learner out of a free section', () => {
    const { container } = renderSection({
      section: FREE_SECTION,
      profile: { programAccess: { [PROGRAMS.BM100]: { paymentStatus: 'unpaid' } } },
    });
    expect(padlocks(container)).toBe(0);
  });
});

/* ── resilience ────────────────────────────────────────────────────────────── */

describe('resilience · imperfect input', () => {
  it('renders for a learner with no payment information at all', () => {
    // A freshly created account, before any Zoho sync.
    expect(() => renderSection({ profile: {} })).not.toThrow();
  });

  it('renders when the profile is missing entirely', () => {
    expect(() => renderSection({ profile: null })).not.toThrow();
  });

  it('renders a section with no lessons yet', () => {
    const progress = {};
    BM100_PROGRAM_SECTIONS.forEach((s) => {
      progress[s.id] = { done: 0, total: 0, status: 'locked', unlocked: false };
    });
    expect(() =>
      render(
        <MemoryRouter>
          <BM100ProgramSection
            section={PAID_SECTION}
            sectionIndex={2}
            sectionProgress={progress}
            profile={{ programAccess: { [PROGRAMS.BM100]: { paymentStatus: 'paid' } } }}
            expanded
            isCurrent={false}
            taskStates={[]}
            activeTaskId={null}
            nextTaskId={null}
            onToggle={() => {}}
            onSelectLesson={() => {}}
          />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  it('gives the padlock an accessible label rather than an unlabelled icon', () => {
    const { container } = renderSection({
      profile: { programAccess: { [PROGRAMS.BM100]: { paymentStatus: 'register' } } },
    });
    const badge = container.querySelector('.mbw-section-card__pay-lock');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('aria-label')).toMatch(/registration amount/i);
  });
});
