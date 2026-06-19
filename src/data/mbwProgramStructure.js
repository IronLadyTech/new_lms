/** MBW program journey — sections beyond Pre-Preparation are gated placeholders until content ships. */

export const MBW_PROGRAM_META = {
  title: 'Master of Business Warfare',
  tagline: 'A 1-year program — your path to the C-suite.',
  duration: '1 year',
  label: 'Program',
};

export const MBW_SECTION_STATUS = {
  DONE: 'done',
  IN_PROGRESS: 'in_progress',
  LOCKED: 'locked',
};

export const MBW_GATE_TYPES = {
  PREPARATION: 'preparation',
  BATCH: 'batch',
  PAID: 'paid',
  SEQUENCE: 'sequence',
  MEMBERS: 'members',
};

export const MBW_PROGRAM_SECTIONS = [
  {
    id: 'pre-preparation',
    title: 'Pre-Preparation',
    subtitle: '12 lessons · before your 1-year cohort',
    usesTaskEngine: true,
    gate: null,
  },
  {
    id: 'quarter-1',
    title: 'Quarter 1',
    subtitle: '17 lessons · Wk1–Wk12',
    usesTaskEngine: true,
    gate: { type: MBW_GATE_TYPES.PREPARATION, requiresSectionId: 'pre-preparation' },
    lockedMessage: 'Complete Pre-Preparation to unlock Quarter 1.',
  },
  {
    id: 'quarter-2',
    title: 'Quarter 2',
    subtitle: '17 lessons · Wk13–Wk24',
    usesTaskEngine: true,
    gate: { type: MBW_GATE_TYPES.SEQUENCE, requiresSectionId: 'quarter-1' },
    lockedMessage: 'Complete Quarter 1 to unlock Quarter 2.',
  },
  {
    id: 'quarter-3',
    title: 'Quarter 3',
    subtitle: '17 lessons · Wk25–Wk36',
    usesTaskEngine: true,
    gate: { type: MBW_GATE_TYPES.SEQUENCE, requiresSectionId: 'quarter-2' },
    lockedMessage: 'Complete Quarter 2 to unlock Quarter 3.',
  },
  {
    id: 'quarter-4',
    title: 'Quarter 4',
    subtitle: '17 lessons · Wk37–Wk48',
    usesTaskEngine: true,
    gate: { type: MBW_GATE_TYPES.SEQUENCE, requiresSectionId: 'quarter-3' },
    lockedMessage: 'Complete Quarter 3 to unlock Quarter 4.',
  },
  {
    id: 'graduation',
    title: 'Graduation',
    subtitle: '5 lessons · Wk49–Wk52',
    usesTaskEngine: true,
    gate: { type: MBW_GATE_TYPES.SEQUENCE, requiresSectionId: 'quarter-4' },
    lockedMessage: 'Complete Quarter 4 to unlock Graduation.',
  },
  {
    id: 'monthly-recordings',
    title: 'Monthly Session Recordings',
    subtitle: 'Batch recordings · updated monthly',
    usesTaskEngine: false,
    gate: { type: MBW_GATE_TYPES.BATCH, requiresSectionId: 'quarter-1' },
    lockedMessage: 'Recordings appear here once your cohort begins live sessions.',
    milestoneCount: 6,
  },
  {
    id: 'csuite-community',
    title: 'C-Suite League Community',
    subtitle: 'Discussions · guest sessions',
    usesTaskEngine: false,
    gate: { type: MBW_GATE_TYPES.MEMBERS, requiresSectionId: 'quarter-2' },
    lockedMessage: 'Members-only community — unlocks after Quarter 2 begins.',
    unlockCta: { label: 'Learn about membership', href: '/app/support' },
    milestoneCount: 4,
  },
];
