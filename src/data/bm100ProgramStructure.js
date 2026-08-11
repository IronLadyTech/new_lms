/** 100 Board Members program — 6-month cohort journey from weekly session sheet. */

export const BM100_PROGRAM_META = {
  title: '100 Board Members',
  tagline: 'A 6-month program — your path to the boardroom.',
  duration: '6 months',
  label: 'Program',
};

export const BM100_SECTION_STATUS = {
  DONE: 'done',
  IN_PROGRESS: 'in_progress',
  LOCKED: 'locked',
};

export const BM100_GATE_TYPES = {
  PREPARATION: 'preparation',
  SEQUENCE: 'sequence',
  PAID: 'paid',
};

export const BM100_PROGRAM_SECTIONS = [
  {
    id: 'onboarding',
    title: 'Onboarding',
    subtitle: '2 lessons · before Week 1',
    usesTaskEngine: true,
    gate: null,
  },
  {
    id: 'phase-1-foundation',
    title: 'Phase 1 — Foundation',
    subtitle: '8 lessons · Wk1–Wk8',
    usesTaskEngine: true,
    gate: { type: BM100_GATE_TYPES.PREPARATION, requiresSectionId: 'onboarding' },
    lockedMessage: 'Complete Onboarding to unlock Phase 1.',
  },
  {
    id: 'phase-2-pitch-strategy',
    title: 'Phase 2 — Pitch & Strategy',
    subtitle: '6 lessons · Wk9–Wk14',
    usesTaskEngine: true,
    gate: {
      type: BM100_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'phase-1-foundation',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Phase 1 and full program payment to unlock Phase 2.',
  },
  {
    id: 'phase-3-board-ready',
    title: 'Phase 3 — Board Ready',
    subtitle: '3 lessons · Wk15–Wk17',
    usesTaskEngine: true,
    gate: {
      type: BM100_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'phase-2-pitch-strategy',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Phase 2 and full program payment to unlock Phase 3.',
  },
  {
    id: 'phase-4-challenges',
    title: 'Phase 4 — Challenges',
    subtitle: '6 lessons · Wk18–Wk23',
    usesTaskEngine: true,
    gate: {
      type: BM100_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'phase-3-board-ready',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Phase 3 and full program payment to unlock Phase 4.',
  },
  {
    id: 'graduation',
    title: 'Graduation',
    subtitle: '1 lesson · Wk24',
    usesTaskEngine: true,
    gate: {
      type: BM100_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'phase-4-challenges',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Phase 4 and full program payment to unlock Graduation.',
  },
];
