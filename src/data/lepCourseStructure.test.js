import { describe, it, expect } from 'vitest';
import { LEP_STATIC_TASKS } from './lepStaticTasks';
import { LEP_PROGRAM_SECTIONS } from './lepProgramStructure';

/**
 * LEP against the course outline.
 *
 * The programme was rebuilt from the Moodle outline: eleven phases, preparation
 * ahead of orientation, and the teaching days giving way to weeks after Day 2.
 * A structure this shape is easy to drift — a task quietly lands in the wrong
 * week and nothing fails — so the outline is pinned here.
 *
 * Task ids are the Firestore submission key (`${userId}_${taskId}`). Every id
 * that existed before the restructure still exists, in a new phase: moving a
 * task must never strand what a learner has already submitted against it.
 */

const PHASES = [
  'pre-program',
  'orientation',
  'day-1',
  'day-2',
  'week-1',
  'week-2',
  'week-3',
  'week-4',
  'community',
  'evaluation',
  'certificate',
];

const inPhase = (phase) =>
  LEP_STATIC_TASKS.filter((t) => t.phase === phase)
    .sort((a, b) => a.order - b.order)
    .map((t) => t.title);

const section = (id) => LEP_PROGRAM_SECTIONS.find((s) => s.id === id);

describe('the phases follow the outline', () => {
  it('runs eleven phases in the order the outline gives them', () => {
    expect(LEP_PROGRAM_SECTIONS.map((s) => s.id)).toEqual(PHASES);
  });

  it('puts preparation before orientation, not after it', () => {
    // The VIA survey, the CoDeSeF sheet and NSDC registration are done before
    // the programme opens; reading the framework is not a prerequisite for them.
    expect(LEP_PROGRAM_SECTIONS[0].id).toBe('pre-program');
    expect(section('pre-program').gate).toBeNull();
    expect(section('orientation').gate.requiresSectionId).toBe('pre-program');
  });

  it('chains the teaching line, and hangs community off payment alone', () => {
    /* Community Sessions run alongside the programme rather than inside it, so
       the chain steps over it: Week 4 leads to Final Evaluation. */
    const LINE = [
      'pre-program',
      'orientation',
      'day-1',
      'day-2',
      'week-1',
      'week-2',
      'week-3',
      'week-4',
      'evaluation',
      'certificate',
    ];
    for (let i = 1; i < LINE.length; i += 1) {
      expect(section(LINE[i]).gate.requiresSectionId, `${LINE[i]} is not chained`).toBe(
        LINE[i - 1]
      );
    }
    expect(section('community').gate.requiresSectionId).toBeUndefined();
  });

  it('leaves every task in a phase that exists', () => {
    const known = new Set(PHASES);
    const orphans = LEP_STATIC_TASKS.filter((t) => !known.has(t.phase)).map((t) => t.id);
    expect(orphans).toEqual([]);
  });

  it('gives no phase an empty task list', () => {
    for (const id of PHASES) expect(inPhase(id).length, `${id} is empty`).toBeGreaterThan(0);
  });
});

describe('each phase holds what the outline lists', () => {
  it('01 Pre-Program Preparation', () => {
    expect(inPhase('pre-program')).toEqual([
      'Complete your VIA Survey and Submit your 3 Photographs',
      'Fill the CoDeSeF Sheet',
      'Complete NSDC Registration',
    ]);
  });

  it('02 Program Orientation', () => {
    expect(inPhase('orientation')).toEqual([
      'Program Framework',
      'Program Access Essentials',
      'Program Schedule',
    ]);
  });

  it('04 Day 2 closes with the feedback for Days 1–2', () => {
    // It used to sit in Day 3 as "Feedback — Days 1 to 3".
    expect(inPhase('day-2').at(-1)).toBe('Feedback for Days 1–2');
  });

  it('05 Week 1 carries Strength Based Excellence, its form and its challenge', () => {
    expect(inPhase('week-1')).toEqual([
      '0.5% League Roadmap — worked sample',
      'Your 0.5% League Roadmap',
      'Feedback — Differentiated Brand Statement',
      'Week 1 Engagement Form',
      'Challenge for Week 1',
    ]);
  });

  it('06 Week 2 opens with the five videos, then resume, then the pitch', () => {
    const week2 = inPhase('week-2');
    expect(week2.slice(0, 5)).toEqual([
      '27 Principles',
      'Practising the 5 Rituals',
      'Differentiated Brand and the 0.5% League Roadmap',
      'Finding and Working with Mentors',
      'Getting Maximum Value from LEP',
    ]);
    expect(week2).toContain('Build your LinkedIn Profile');
    expect(week2).toContain('Your Shameless Pitch');
  });

  it('07 Week 3 leads with the Progress Review', () => {
    expect(inPhase('week-3')[0]).toBe('Progress Review');
    expect(inPhase('week-3')).toContain('Guiding Stars');
  });

  it('08 Week 4 is graduation', () => {
    expect(inPhase('week-4')).toContain('Graduation Preparations');
    expect(inPhase('week-4')).toContain('Join the Iron Lady Alumni');
    expect(inPhase('week-4')).toContain('Challenge for Week 4');
  });

  it('gives every week its own engagement form and challenge', () => {
    for (const week of [1, 2, 3, 4]) {
      const titles = inPhase(`week-${week}`);
      expect(titles, `week ${week} form`).toContain(`Week ${week} Engagement Form`);
      expect(titles, `week ${week} challenge`).toContain(`Challenge for Week ${week}`);
    }
  });
});

describe('nothing a learner has submitted against is stranded', () => {
  /* Every id present before the restructure. None may disappear. */
  const PRE_EXISTING = [
    'lep-orientation-framework',
    'lep-orientation-access',
    'lep-orientation-schedule',
    'lep-via-survey',
    'lep-day1-promises',
    'lep-day1-beliefs',
    'lep-day1-agame-table',
    'lep-day1-errc',
    'lep-day1-crucible',
    'lep-day1-assignment',
    'lep-day2-codesef',
    'lep-day2-responding',
    'lep-day2-relationships',
    'lep-day2-purpose-peg',
    'lep-day2-assignment',
    'lep-day3-27-principles',
    'lep-day3-5-rituals',
    'lep-day3-brand-roadmap',
    'lep-day3-mentors',
    'lep-day3-max-value',
    'lep-day3-feedback',
    'lep-day4-roadmap-sample',
    'lep-day4-roadmap',
    'lep-day4-feedback',
    'lep-resume-linkedin',
    'lep-resume-template-study',
    'lep-resume-bootcamp',
    'lep-resume-prepare',
    'lep-day5-instructions',
    'lep-day5-pitch',
    'lep-day5-feedback',
    'lep-day6-guiding-stars',
    'lep-day6-feedback',
    'lep-day7-review',
    'lep-day8-preparation',
    'lep-day8-alumni',
    'lep-day8-feedback',
    'lep-weekly-1',
    'lep-weekly-2',
    'lep-weekly-3',
    'lep-weekly-4',
    'lep-weekly-5',
    'lep-community-schedule',
    'lep-community-handholding',
    'lep-quiz-5-rituals',
    'lep-quiz-27-principles',
    'lep-attendance',
    'lep-certification',
  ];

  it('keeps every id that existed before the restructure', () => {
    const now = new Set(LEP_STATIC_TASKS.map((t) => t.id));
    const lost = PRE_EXISTING.filter((id) => !now.has(id));
    expect(lost).toEqual([]);
  });

  it('parks the week 5 form in Week 4 rather than dropping it', () => {
    // The outline runs four weeks and lists no week 5 form. The id is a live
    // submission key, so it is rehomed rather than deleted.
    const w5 = LEP_STATIC_TASKS.find((t) => t.id === 'lep-weekly-5');
    expect(w5.phase).toBe('week-4');
  });

  it('gives the new tasks ids of their own', () => {
    for (const id of ['lep-prep-codesef-sheet', 'lep-prep-nsdc', 'lep-challenge-1']) {
      expect(
        LEP_STATIC_TASKS.some((t) => t.id === id),
        `${id} missing`
      ).toBe(true);
    }
    // The pre-programme sheet is not the Day 2 exercise wearing the same key.
    expect(LEP_STATIC_TASKS.find((t) => t.id === 'lep-prep-codesef-sheet').phase).toBe(
      'pre-program'
    );
    expect(LEP_STATIC_TASKS.find((t) => t.id === 'lep-day2-codesef').phase).toBe('day-2');
  });
});

describe('the paid wall', () => {
  it('opens preparation through Day 2 on the registration amount', () => {
    for (const id of ['pre-program', 'orientation', 'day-1', 'day-2']) {
      expect(section(id).gate?.requiresPaid, `${id} should be free`).toBeFalsy();
    }
  });

  it('puts every week behind full payment', () => {
    for (const id of ['week-1', 'week-2', 'week-3', 'week-4']) {
      expect(section(id).gate.requiresPaid, `${id} should be paid`).toBe(true);
    }
  });
});
