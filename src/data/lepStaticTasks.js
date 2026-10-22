import { TASK_TYPES } from '../services/mbwService';

/**
 * Leadership Essentials Program — static task list, mapped from the live Moodle
 * course outline.
 *
 * `id` is the Firestore submission key (`${userId}_${taskId}`). It is not a
 * display value and must stay stable: recycling an id for a different task
 * re-attaches an existing learner's submission to the wrong one.
 *
 * `order` is banded by phase — 0 pre-program, 100 orientation, 200 Day 1, 300
 * Day 2, 400–700 Weeks 1–4, 800 community, 900 evaluation, 1000 certificate —
 * with the position inside the phase added on. Tasks of one phase have to stay
 * contiguous once sorted, and a flat running number could not survive a phase
 * being resequenced without renumbering every task after it.
 *
 * Resource files live in `public/templates/lep/` and are served from the app,
 * so the programme does not depend on Moodle staying up.
 *
 * `videoUrl` is intentionally empty everywhere. The session recordings are
 * coming as YouTube links; an invented or guessed URL would render a dead
 * player, so these stay blank until the real links arrive and the player
 * simply does not render. Do not fill them with placeholders.
 */

/** @typedef {{ label: string, url: string }} LepResourceLink */

const T = (p) => `/templates/lep/${p}`;

export const LEP_STATIC_TASKS = [
  /* ---------------------------------------------------------- Orientation */
  {
    id: 'lep-orientation-framework',
    order: 100,
    phase: 'orientation',
    week: 'Start',
    title: 'Program Framework',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Read the programme framework and confirm you know how the four weeks are structured.',
    readingDocument: {
      label: 'Leadership Essentials Program Information',
      url: T('lep-program-framework.pdf'),
    },
    checklistItems: [
      'I have read the programme framework',
      'I know which days are live sessions',
      'I know what is expected of me each week',
    ],
  },
  {
    id: 'lep-orientation-access',
    order: 101,
    phase: 'orientation',
    week: 'Start',
    title: 'Program Access Essentials',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Set up your access so nothing blocks you on Day 1.',
    readingDocument: {
      label: 'Program Access Essentials',
      url: T('program-access-essentials.pdf'),
    },
    checklistItems: [
      'I can sign in to the programme',
      'I have joined the community group',
      'I have the session joining details',
    ],
  },
  {
    id: 'lep-orientation-schedule',
    order: 102,
    phase: 'orientation',
    week: 'Start',
    title: 'Program Schedule',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    /*
     * Moodle attaches a generic schedule file here. This batch's real dates
     * live on the calendar, which is why this points there rather than
     * shipping a second, staler copy of the same information.
     */
    description: 'Check your batch dates on the calendar and block them out.',
    resourceLinks: [{ label: 'Your batch calendar', url: '/app/calendar' }],
    checklistItems: ['I have blocked out all session dates in my own calendar'],
  },

  /* ------------------------------------------------- Pre-Program Prep */
  {
    id: 'lep-via-survey',
    order: 0,
    phase: 'pre-program',
    week: 'Prep',
    title: 'Complete your VIA Survey and Submit your 3 Photographs',
    type: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Register and complete the VIA Character Survey, then upload your free survey report. Your individualised excellence profile depends on this — it cannot be produced without your report.',
    resourceLinks: [{ label: 'VIA Character Survey', url: 'https://www.viacharacter.org' }],
    accept: '.pdf,.doc,.docx',
    uploadSubmitLabel: 'Submit VIA report',
    uploadKind: 'file',
  },

  {
    /*
     * The CoDeSeF sheet is filled before the programme opens and worked again on
     * Day 2 — the outline lists it in both places. Separate ids, because they
     * are separate submissions.
     */
    id: 'lep-prep-codesef-sheet',
    order: 1,
    phase: 'pre-program',
    week: 'Prep',
    title: 'Fill the CoDeSeF Sheet',
    /* The same four-step sheet as Day 2, filled in on the page. Was an upload. */
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'codesef',
    previousType: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Fill in your CoDeSeF sheet before Day 1. Work through the four steps in order — each one builds on the step above it.',
    /* Page 1 of the handout explains CoDeSeF; pages 2–3 are the activity below. */
    readingDocument: {
      label: 'What CoDeSeF is',
      url: T('codesef-guidelines-template.pdf'),
      pages: [1],
    },
    resourceLinks: [
      { label: 'CoDeSeF Guidelines and Template', url: T('codesef-guidelines-template.pdf') },
    ],
    uploadSubmitLabel: 'Submit CoDeSeF sheet',
  },
  {
    id: 'lep-prep-nsdc',
    order: 2,
    phase: 'pre-program',
    week: 'Prep',
    title: 'Complete NSDC Registration',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    /* No registration URL in the outline, so none is invented here — the link
       belongs in `resourceLinks` once Iron Lady supplies it. */
    description: 'Complete your NSDC registration and submit the confirmation link.',
    uploadSubmitLabel: 'Submit registration link',
  },

  /* --------------------------------------- Day 1 — Personal Transformation */
  {
    id: 'lep-day1-promises',
    order: 200,
    phase: 'day-1',
    week: 'Day 1',
    title: 'Promises and Agreements',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Read the promises and agreements for the programme and sign them.',
    checklistItems: ['I have read and signed the promises and agreements'],
  },
  {
    id: 'lep-day1-beliefs',
    order: 201,
    phase: 'day-1',
    week: 'Day 1',
    title: 'A-Game Self Awareness — Beliefs',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'agame-beliefs',
    previousType: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Work through the beliefs questionnaire and answer every question. This is what enables you to play your A-Game.',
    resourceLinks: [
      { label: 'A-Game Beliefs Questionnaire', url: T('a-game-beliefs-questionnaire.pdf') },
    ],
    uploadSubmitLabel: 'Submit your answers',
  },
  {
    id: 'lep-day1-agame-table',
    order: 202,
    phase: 'day-1',
    week: 'Day 1',
    title: 'A-Game Table — daily ritual',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'agame-table',
    previousType: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Fill in your A-Game table for today: the moments you were at your best, and the moments you were not.',
    resourceLinks: [{ label: 'A-Game Table Template', url: T('a-game-table.pdf') }],
    uploadSubmitLabel: 'Submit A-Game table',
  },
  {
    id: 'lep-day1-errc',
    order: 203,
    phase: 'day-1',
    week: 'Day 1',
    title: 'ERRC Table',
    /*
     * The same fillable table 100BM uses, not a free-text box. The ERRC grid is
     * shared and programme-agnostic — asking an LEP learner to retype four
     * columns into a textarea when the table already exists would have been a
     * worse version of the same exercise.
     */
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'errc',
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Complete your ERRC table below — what you will Eliminate, Reduce, Raise and Create. Fill every block before submitting.',
    resourceLinks: [{ label: 'ERRC Template', url: T('errc-template.pdf') }],
    uploadSubmitLabel: 'Submit ERRC table',
  },
  {
    id: 'lep-day1-crucible',
    order: 204,
    phase: 'day-1',
    week: 'Day 1',
    title: 'Crucibles of Leadership',
    /*
     * The worksheet is five questions worked through one at a time, then three
     * statements drawn from them — not one open box. Asking for the statement
     * alone skipped the reflection that produces it.
     */
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'crucible',
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Read each question, close your eyes and ask it of yourself, then open your eyes and write your answer. Work through all five in the same way before writing your statement.',
    resourceLinks: [{ label: 'Crucibles of Leadership', url: T('crucibles-of-leadership.pdf') }],
    uploadSubmitLabel: 'Submit crucible statement',
  },
  {
    id: 'lep-day1-assignment',
    order: 205,
    phase: 'day-1',
    week: 'Day 1',
    title: 'Day 1 Assignment',
    type: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description:
      'Download the Day 1 assignment, answer all questions and upload your completed work.',
    readingDocument: {
      label: 'Affirmations — Sense of Internal Confidence',
      url: T('standard-affirmations.pdf'),
    },
    accept: '.pdf,.doc,.docx',
    uploadSubmitLabel: 'Submit Day 1 assignment',
    uploadKind: 'file',
  },

  /* ------------------------------------- Day 2 — Strategies and Tactics */
  {
    id: 'lep-day2-codesef',
    order: 300,
    phase: 'day-2',
    week: 'Day 2',
    title: 'CoDeSeF',
    /*
     * Four ordered steps, not one box: each is built from the one above it, and
     * a single textarea gave the learner no sense of that sequence.
     */
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'codesef',
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Iron Lady’s technique for strategising towards your BHAG. Work through the four steps in order — each one builds on the step above it.',
    readingDocument: {
      label: 'What CoDeSeF is',
      url: T('codesef-guidelines-template.pdf'),
      pages: [1],
    },
    resourceLinks: [
      { label: 'CoDeSeF Guidelines and Template', url: T('codesef-guidelines-template.pdf') },
    ],
    uploadSubmitLabel: 'Submit CoDeSeF',
  },
  {
    id: 'lep-day2-responding',
    order: 301,
    phase: 'day-2',
    week: 'Day 2',
    title: 'Powerful Extreme Responding',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'responding',
    previousType: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'For each situation, mark whether you respond or react. The total shows your pattern.',
    resourceLinks: [
      { label: 'Respond vs React questionnaire', url: T('powerful-responding-tactics.pdf') },
    ],
    uploadSubmitLabel: 'Submit your answers',
  },
  {
    id: 'lep-day2-relationships',
    order: 302,
    phase: 'day-2',
    week: 'Day 2',
    title: 'Maximise Key Relationships',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'key-relationships',
    previousType: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Identify your key relationships and how you will strengthen each one.',
    resourceLinks: [
      { label: 'Maximise Key Relationships', url: T('maximise-key-relationships.pdf') },
    ],
    uploadSubmitLabel: 'Submit your relationship map',
  },
  {
    id: 'lep-day2-purpose-peg',
    order: 303,
    phase: 'day-2',
    week: 'Day 2',
    title: 'Purpose Peg Table',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'purpose-peg',
    previousType: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Complete your Purpose Peg table. The samples show the level of detail expected.',
    resourceLinks: [
      { label: 'Purpose Peg Table', url: T('purpose-peg-table.pdf') },
      { label: 'Purpose Peg Samples', url: T('purpose-peg-samples.pdf') },
    ],
    uploadSubmitLabel: 'Submit Purpose Peg table',
  },
  {
    id: 'lep-day2-assignment',
    order: 304,
    phase: 'day-2',
    week: 'Day 2',
    title: 'Day 2 Assignment',
    type: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description: 'Download the Day 2 assignment, answer all questions and upload your work.',
    accept: '.pdf,.doc,.docx',
    uploadSubmitLabel: 'Submit Day 2 assignment',
    uploadKind: 'file',
  },

  /* --------------------------------- Day 3 — Consolidation and Closure */
  {
    id: 'lep-day3-27-principles',
    order: 500,
    phase: 'week-2',
    week: 'Day 3',
    title: '27 Principles',
    type: TASK_TYPES.CHECKLIST,
    /* The video is served by getLessonAsset (functions/lessonAssets.js), never from here. */
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the 27 Principles session and note the ones you will act on.',
    checklistItems: ['I have watched the 27 Principles session'],
  },
  {
    id: 'lep-day3-5-rituals',
    order: 501,
    phase: 'week-2',
    week: 'Day 3',
    title: 'Practising the 5 Rituals',
    type: TASK_TYPES.CHECKLIST,
    /* The video is served by getLessonAsset (functions/lessonAssets.js), never from here. */
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Start the five daily rituals and keep them going.',
    checklistItems: ['I know all five rituals', 'I have started practising them daily'],
  },
  {
    id: 'lep-day3-brand-roadmap',
    order: 502,
    phase: 'week-2',
    week: 'Day 3',
    title: 'Differentiated Brand and the 0.5% League Roadmap',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description:
      'Understand how to use your differentiated brand to build your 0.5% League roadmap.',
    checklistItems: ['I understand how to build my 0.5% League roadmap'],
  },
  {
    id: 'lep-day3-mentors',
    order: 503,
    phase: 'week-2',
    week: 'Day 3',
    title: 'Finding and Working with Mentors',
    type: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Name the mentors you will approach and what you will ask of each.',
    uploadSubmitLabel: 'Submit your mentor list',
  },
  {
    id: 'lep-day3-max-value',
    order: 504,
    phase: 'week-2',
    week: 'Day 3',
    title: 'Getting Maximum Value from LEP',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Know what the programme offers beyond the sessions and how to use it.',
    checklistItems: ['I know how to get the most from this programme'],
  },
  {
    id: 'lep-day3-feedback',
    order: 305,
    phase: 'day-2',
    week: 'Day 3',
    title: 'Feedback for Days 1–2',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Share your feedback on the first three days.',
    uploadSubmitLabel: 'Submit feedback link',
  },

  /* ------------------------------- Day 4 — Strength Based Excellence */
  {
    id: 'lep-day4-roadmap-sample',
    order: 400,
    phase: 'week-1',
    week: 'Day 4',
    title: '0.5% League Roadmap — worked sample',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Study the worked sample before building your own roadmap.',
    readingDocument: {
      label: 'Differentiated Strength — worked sample',
      url: T('league-roadmap-sample.pdf'),
    },
    checklistItems: ['I have studied the sample roadmap'],
  },
  {
    id: 'lep-day4-roadmap',
    order: 401,
    phase: 'week-1',
    week: 'Day 4',
    title: 'Your 0.5% League Roadmap',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    templateId: 'league-roadmap',
    previousType: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description:
      'Build your own 0.5% League roadmap. The worked sample shows the level of detail expected.',
    resourceLinks: [{ label: '0.5% League Roadmap Sample', url: T('league-roadmap-sample.pdf') }],
    uploadSubmitLabel: 'Submit your roadmap',
  },
  {
    id: 'lep-day4-feedback',
    order: 402,
    phase: 'week-1',
    week: 'Day 4',
    title: 'Feedback — Differentiated Brand Statement',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Share your feedback on Day 4.',
    uploadSubmitLabel: 'Submit feedback link',
  },

  /* ------------------------------------- Build your Profile / Resume */
  {
    id: 'lep-resume-linkedin',
    order: 505,
    phase: 'week-2',
    week: 'Week 2',
    title: 'Build your LinkedIn Profile',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Rebuild your LinkedIn profile, then share the link to it.',
    uploadSubmitLabel: 'Submit LinkedIn URL',
  },
  {
    id: 'lep-resume-template-study',
    order: 506,
    phase: 'week-2',
    week: 'Week 2',
    title: 'Resume Template and Samples',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Study the Iron Lady resume format before writing your own.',
    resourceLinks: [
      { label: 'Sample Resume Template', url: T('resume-template.pdf') },
      { label: 'Iron Lady Resume Template', url: '/templates/Iron Lady Resume Template.doc' },
    ],
    checklistItems: ['I have studied the resume template and samples'],
  },
  {
    id: 'lep-resume-bootcamp',
    order: 507,
    phase: 'week-2',
    week: 'Week 2',
    title: 'Jobseekers Bootcamp',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the Jobseekers Bootcamp recording.',
    checklistItems: ['I have watched the bootcamp recording'],
  },
  {
    id: 'lep-resume-prepare',
    order: 508,
    phase: 'week-2',
    week: 'Week 2',
    title: 'Prepare your Resume',
    type: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description: 'Write your resume using the Iron Lady format and upload it.',
    resourceLinks: [{ label: 'Sample Resume Template', url: T('resume-template.pdf') }],
    accept: '.pdf,.doc,.docx',
    uploadSubmitLabel: 'Submit your resume',
    uploadKind: 'resume',
  },

  /* ------------------------------------------ Day 5 — Shameless Pitch */
  {
    id: 'lep-day5-instructions',
    order: 509,
    phase: 'week-2',
    week: 'Day 5',
    title: 'Shameless Pitch — preparation',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Read the preparation instructions and the key points before you pitch.',
    readingDocument: {
      label: 'Shameless Pitch Preparation Instructions',
      url: T('shameless-pitch-instructions.pdf'),
    },
    checklistItems: ['I have read the preparation instructions', 'I have read the key points'],
  },
  {
    id: 'lep-day5-pitch',
    order: 510,
    phase: 'week-2',
    week: 'Day 5',
    title: 'Your Shameless Pitch',
    type: TASK_TYPES.VIDEO_RECORD,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description: 'Record and submit your shameless pitch.',
    uploadSubmitLabel: 'Submit pitch video',
    uploadKind: 'video',
  },
  {
    id: 'lep-day5-feedback',
    order: 511,
    phase: 'week-2',
    week: 'Day 5',
    title: 'Feedback — Shameless Pitching',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Share your feedback on the pitching session.',
    uploadSubmitLabel: 'Submit feedback link',
  },

  /* ---------------------------------------------- Day 6 — Guiding Stars */
  {
    id: 'lep-day6-guiding-stars',
    order: 601,
    phase: 'week-3',
    week: 'Day 6',
    title: 'Guiding Stars',
    type: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Identify your guiding stars and what each one means for your next step.',
    readingDocument: { label: 'Guiding Stars Poster', url: T('guiding-stars.pdf') },
    uploadSubmitLabel: 'Submit your guiding stars',
  },
  {
    id: 'lep-day6-feedback',
    order: 602,
    phase: 'week-3',
    week: 'Day 6',
    title: 'Feedback — Guiding Stars',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Share your feedback on Day 6.',
    uploadSubmitLabel: 'Submit feedback link',
  },

  /* --------------------------------------------- Day 7 — Progress Review */
  {
    id: 'lep-day7-review',
    /* Ahead of Guiding Stars — the order the outline gives Week 3. */
    order: 600,
    phase: 'week-3',
    week: 'Day 7',
    title: 'Progress Review',
    type: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description:
      'Review your progress across the programme so far — what has changed, and what is still open.',
    uploadSubmitLabel: 'Submit your review',
  },

  /* --------------------------------------------- Day 8 — Graduation Day */
  {
    id: 'lep-day8-preparation',
    order: 700,
    phase: 'week-4',
    week: 'Day 8',
    title: 'Graduation Preparations',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Prepare for graduation day.',
    checklistItems: ['I have completed my graduation preparations'],
  },
  {
    id: 'lep-day8-alumni',
    order: 701,
    phase: 'week-4',
    week: 'Day 8',
    title: 'Join the Iron Lady Alumni',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Join the Iron Lady Alumni network on LinkedIn and share your profile link.',
    uploadSubmitLabel: 'Submit LinkedIn URL',
  },
  {
    id: 'lep-day8-feedback',
    order: 702,
    phase: 'week-4',
    week: 'Day 8',
    title: 'Graduation Feedback',
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Share your feedback on the programme.',
    uploadSubmitLabel: 'Submit feedback link',
  },

  /*
   * Weekly engagement forms and challenges.
   *
   * These used to sit together in a "Weekly Progress Updates" section of their
   * own. The outline puts each one inside its week, beside that week's work,
   * which is where a learner looks for it.
   *
   * Week 5 has no week of its own — the programme runs four. Its form is kept
   * in Week 4 rather than dropped: `lep-weekly-5` is a live submission key, and
   * removing it would strand whatever has already been submitted against it.
   */
  ...[1, 2, 3, 4, 5].map((week, i) => ({
    id: `lep-weekly-${week}`,
    /* Sits at the end of its own week — see the order bands below. */
    order: 400 + (Math.min(week, 4) - 1) * 100 + 80 + (week === 5 ? 1 : 0),
    phase: `week-${Math.min(week, 4)}`,
    week: `Week ${week}`,
    title: `Week ${week} Engagement Form`,
    type: TASK_TYPES.LINK,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: `Complete the week ${week} engagement form.`,
    uploadSubmitLabel: 'Submit form link',
  })),

  /*
   * Challenge for each week — the Game of Excellence.
   *
   * New in this outline, so new ids. The type is a written submission because
   * the outline names the challenge without saying what is handed in; if these
   * turn out to be a link or an upload, only the `type` changes.
   */
  ...[1, 2, 3, 4].map((week, i) => ({
    id: `lep-challenge-${week}`,
    order: 400 + (week - 1) * 100 + 90,
    phase: `week-${week}`,
    week: `Week ${week}`,
    title: `Challenge for Week ${week}`,
    type: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description: `Game of Excellence — complete the week ${week} challenge and tell us how it went.`,
  })),

  /* ------------------------------------------------- Community Sessions */
  {
    id: 'lep-community-schedule',
    order: 800,
    phase: 'community',
    week: 'Ongoing',
    title: 'Community Sessions Schedule',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Check the community session schedule and attend what applies to you.',
    resourceLinks: [{ label: 'Your batch calendar', url: '/app/calendar' }],
    checklistItems: ['I know when the community sessions run'],
  },
  {
    id: 'lep-community-handholding',
    order: 801,
    phase: 'community',
    week: 'Ongoing',
    title: 'Weekly Handholding Sessions',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'See what the weekly handholding sessions cover for the Iron Lady community.',
    checklistItems: ['I know what the handholding sessions offer'],
  },

  /* ---------------------------------------------------- Final Evaluation */
  {
    id: 'lep-quiz-5-rituals',
    order: 900,
    phase: 'evaluation',
    week: 'Week 4',
    title: '5 Daily Rituals — Quiz',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Complete the 5 Daily Rituals quiz.',
    checklistItems: ['I have completed the 5 Daily Rituals quiz'],
  },
  {
    id: 'lep-quiz-27-principles',
    order: 901,
    phase: 'evaluation',
    week: 'Week 4',
    title: '27 Principles — Quiz',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Complete the 27 Principles quiz.',
    checklistItems: ['I have completed the 27 Principles quiz'],
  },

  /* --------------------------------------------------------- Certificate */
  {
    id: 'lep-attendance',
    order: 1000,
    phase: 'certificate',
    week: 'Close',
    title: 'Attendance',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Confirm your attendance record is complete.',
    checklistItems: ['My attendance record is complete'],
  },
  {
    id: 'lep-certification',
    order: 1001,
    phase: 'certificate',
    week: 'Close',
    title: 'LEP Certification',
    type: TASK_TYPES.CHECKLIST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Collect your Leadership Essentials Program certificate.',
    checklistItems: ['I have collected my certificate'],
  },
];

export function getLepStaticTasks() {
  return [...LEP_STATIC_TASKS].sort((a, b) => a.order - b.order);
}
