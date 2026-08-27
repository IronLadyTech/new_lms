/**
 * Leadership Essentials Program — the 4-week entry programme.
 *
 * Sections follow the live Moodle course outline. Moodle interleaves the weekly
 * engagement forms between the teaching days as their own topics; they are
 * gathered into one section here because five one-item topics scattered through
 * the journey read as noise rather than as a strand of their own.
 *
 * Moodle's empty "Topic 11 / 12 / 13 / 22" placeholders are deliberately not
 * carried over — they hold no content and only lengthen the journey.
 */

export const LEP_PROGRAM_META = {
  title: 'Leadership Essentials Program',
  tagline: 'A 4-week program — build confidence and balance growth.',
  duration: '4 weeks',
  label: 'Program',
};

export const LEP_SECTION_STATUS = {
  DONE: 'done',
  IN_PROGRESS: 'in_progress',
  LOCKED: 'locked',
};

export const LEP_GATE_TYPES = {
  PREPARATION: 'preparation',
  SEQUENCE: 'sequence',
  PAID: 'paid',
};

export const LEP_PROGRAM_SECTIONS = [
  {
    id: 'orientation',
    title: 'Program Orientation',
    subtitle: '3 lessons · before Day 1',
    usesTaskEngine: true,
    gate: null,
  },
  {
    id: 'pre-program',
    title: 'Pre-Program Preparation',
    subtitle: '1 lesson · before Day 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.PREPARATION, requiresSectionId: 'orientation' },
    lockedMessage: 'Complete Program Orientation to unlock Pre-Program Preparation.',
  },
  {
    id: 'day-1',
    title: 'Day 1 — Personal Transformation',
    subtitle: '6 lessons · Week 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'pre-program' },
    lockedMessage: 'Complete the VIA Survey to unlock Day 1.',
  },
  {
    id: 'day-2',
    title: 'Day 2 — Strategies and Tactics',
    subtitle: '5 lessons · Week 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'day-1' },
    lockedMessage: 'Complete Day 1 to unlock Day 2.',
  },
  {
    id: 'day-3',
    title: 'Day 3 — Consolidation and Closure',
    subtitle: '6 lessons · Week 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'day-2' },
    lockedMessage: 'Complete Day 2 to unlock Day 3.',
  },
  {
    id: 'day-4',
    title: 'Day 4 — Strength Based Excellence',
    subtitle: '3 lessons · Week 2',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-3',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 3 and full program payment to unlock Day 4.',
  },
  {
    id: 'resume',
    title: 'Build your Profile / Resume',
    subtitle: '4 lessons · Week 2',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-4',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 4 and full program payment to unlock this section.',
  },
  {
    id: 'day-5',
    title: 'Day 5 — Shameless Pitch',
    subtitle: '3 lessons · Week 3',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'resume',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Build your Profile and full program payment to unlock Day 5.',
  },
  {
    id: 'day-6',
    title: 'Day 6 — Guiding Stars',
    subtitle: '2 lessons · Week 3',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-5',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 5 and full program payment to unlock Day 6.',
  },
  {
    id: 'day-7',
    title: 'Day 7 — Progress Review',
    subtitle: '1 lesson · Week 4',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-6',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 6 and full program payment to unlock Day 7.',
  },
  {
    id: 'day-8',
    title: 'Day 8 — Graduation Day',
    subtitle: '3 lessons · Week 4',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-7',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 7 and full program payment to unlock Graduation.',
  },
  {
    /*
     * Moodle gates each week's form on the previous one being marked complete,
     * which is a sequence within the section rather than against a teaching day.
     */
    id: 'weekly-progress',
    title: 'Weekly Progress Updates',
    subtitle: '5 lessons · Weeks 1–5',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'day-1', requiresPaid: true },
    lockedMessage: 'Start Day 1 and complete full program payment to unlock weekly updates.',
  },
  {
    id: 'community',
    title: 'Community Sessions',
    subtitle: '2 lessons · ongoing',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.PAID },
    lockedMessage: 'Community sessions unlock with full program payment.',
  },
  {
    id: 'evaluation',
    title: 'Final Evaluation',
    subtitle: '2 lessons · Week 4',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-8',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Graduation Day and full program payment to unlock Final Evaluation.',
  },
  {
    id: 'certificate',
    title: 'Certificate',
    subtitle: '2 lessons · on completion',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'evaluation',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Final Evaluation to unlock your certificate.',
  },
];
