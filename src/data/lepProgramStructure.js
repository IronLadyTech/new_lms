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
    /*
     * Pre-Program Preparation leads, ahead of Orientation. That is the order in
     * the course outline: the VIA survey, the CoDeSeF sheet and the NSDC
     * registration are done before the programme opens, not after reading the
     * framework.
     */
    id: 'pre-program',
    title: 'Pre-Program Preparation',
    subtitle: '3 lessons · before Day 1',
    usesTaskEngine: true,
    gate: null,
  },
  {
    id: 'orientation',
    title: 'Program Orientation',
    subtitle: '3 lessons · before Day 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.PREPARATION, requiresSectionId: 'pre-program' },
    lockedMessage: 'Complete Pre-Program Preparation to unlock Program Orientation.',
  },
  {
    id: 'day-1',
    title: 'Day 1 — Personal Transformation',
    subtitle: '6 lessons · Week 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'orientation' },
    lockedMessage: 'Complete Program Orientation to unlock Day 1.',
  },
  {
    id: 'day-2',
    title: 'Day 2 — Strategies and Tactics',
    subtitle: '6 lessons · Week 1',
    usesTaskEngine: true,
    gate: { type: LEP_GATE_TYPES.SEQUENCE, requiresSectionId: 'day-1' },
    lockedMessage: 'Complete Day 1 to unlock Day 2.',
  },
  {
    /*
     * The teaching days give way to weeks here, as the outline does. What used
     * to be Day 4 is the Strength Based Excellence work inside Week 1, and each
     * week now carries its own engagement form and challenge.
     */
    id: 'week-1',
    title: 'Week 1 — Consolidation and Closure',
    subtitle: '5 lessons · Week 1',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'day-2',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Day 2 and full program payment to unlock Week 1.',
  },
  {
    id: 'week-2',
    title: 'Week 2 — Profile, Resume and Pitch',
    subtitle: '14 lessons · Week 2',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'week-1',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Week 1 and full program payment to unlock Week 2.',
  },
  {
    id: 'week-3',
    title: 'Week 3 — Progress Review and Guiding Stars',
    subtitle: '5 lessons · Week 3',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'week-2',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Week 2 and full program payment to unlock Week 3.',
  },
  {
    id: 'week-4',
    title: 'Week 4 — Graduation',
    subtitle: '6 lessons · Week 4',
    usesTaskEngine: true,
    gate: {
      type: LEP_GATE_TYPES.SEQUENCE,
      requiresSectionId: 'week-3',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Week 3 and full program payment to unlock Week 4.',
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
      requiresSectionId: 'week-4',
      requiresPaid: true,
    },
    lockedMessage: 'Complete Week 4 and full program payment to unlock Final Evaluation.',
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
