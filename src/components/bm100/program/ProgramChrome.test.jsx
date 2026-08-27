// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BM100LessonTopbar from './BM100LessonTopbar';
import BM100ProgramHero from './BM100ProgramHero';
import BM100FirstTimePanel from './BM100FirstTimePanel';
import { PROGRAM_UI } from '../../../data/programUiAdapters';
import { PROGRAMS } from '../../../data/programTypes';

/**
 * These components were made generic so LEP could reuse them rather than become
 * a third copy of the journey.
 *
 * The bug this exists to prevent already happened: BM100LessonTopbar kept a
 * module-level `getSectionTitle` that reached for the `program` prop, which a
 * module-level function cannot see. Every lesson view threw
 * "program is not defined" — for LEP *and* for 100BM, because a default prop
 * cannot reach module scope either. 741 tests passed while it was broken,
 * because nothing rendered this chrome.
 *
 * So: render each piece for every programme, and assert it shows that
 * programme's own words.
 */

afterEach(cleanup);

const ADAPTERS = Object.values(PROGRAM_UI);

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe.each(ADAPTERS.map((p) => [p.id, p]))('program chrome — %s', (id, program) => {
  const section = program.sections[2] || program.sections[0];

  it('renders the lesson topbar with the section name', () => {
    wrap(
      <BM100LessonTopbar
        program={program}
        lessonTitle="A lesson"
        sectionPhase={section.id}
        onBack={() => {}}
      />
    );
    expect(screen.getByText('A lesson')).toBeTruthy();
    // The section title, resolved through the adapter rather than module scope.
    expect(screen.getAllByText(section.title).length).toBeGreaterThan(0);
  });

  it('falls back to the programme title for an unknown phase', () => {
    wrap(
      <BM100LessonTopbar
        program={program}
        lessonTitle="A lesson"
        sectionPhase="no-such-phase"
        onBack={() => {}}
      />
    );
    expect(screen.getAllByText(program.meta.title).length).toBeGreaterThan(0);
  });

  it('renders the hero with this programme s own title and tagline', () => {
    wrap(
      <BM100ProgramHero
        program={program}
        cohortLabel="Test cohort"
        completedMilestones={1}
        totalMilestones={4}
      />
    );
    expect(screen.getByText(program.meta.title)).toBeTruthy();
    expect(screen.getByText(program.meta.tagline)).toBeTruthy();
  });

  it('welcomes a new learner to this programme, not another one', () => {
    wrap(<BM100FirstTimePanel program={program} onStart={() => {}} />);
    expect(screen.getByText(`Welcome to ${program.meta.title}`)).toBeTruthy();
    expect(screen.getByText(program.meta.firstTime.cta, { exact: false })).toBeTruthy();
  });
});

describe('program chrome defaults', () => {
  it('renders 100BM when no program prop is passed', () => {
    const bm100 = PROGRAM_UI[PROGRAMS.BM100];
    wrap(<BM100ProgramHero cohortLabel="c" completedMilestones={0} totalMilestones={1} />);
    expect(screen.getByText(bm100.meta.title)).toBeTruthy();
  });

  it('renders the lesson topbar with no program prop', () => {
    const bm100 = PROGRAM_UI[PROGRAMS.BM100];
    wrap(
      <BM100LessonTopbar
        lessonTitle="Lesson"
        sectionPhase={bm100.sections[0].id}
        onBack={() => {}}
      />
    );
    expect(screen.getAllByText(bm100.sections[0].title).length).toBeGreaterThan(0);
  });
});
