/**
 * IL Guide golden scenarios — LEP. Policy and context shape: see ./shared.js.
 * Task ids and titles are the real ones in app-new constants/programCourseSlice.js;
 * session titles come from constants/lepSessionTemplate.js.
 */
const {
  CONTINUE_JOURNEY,
  ctx,
  practice,
  perf,
  lateJoin,
  PAY,
  PROGRAMS,
  PROGRAM_NAMES,
  GUILT,
} = require('./shared');

const NAMES = PROGRAM_NAMES.lep;
void PROGRAMS; // ctx() defaults to LEP

const T = {
  // pre-program (open to register)
  via: {
    id: 'lep-via-survey',
    title: 'Complete your VIA Survey and Submit your 3 Photographs',
    type: 'file',
  },
  codesef: { id: 'lep-prep-codesef-sheet', title: 'Fill the CoDeSeF Sheet', type: 'form' },
  nsdc: { id: 'lep-prep-nsdc', title: 'Complete NSDC Registration', type: 'form' },
  // orientation (open to register)
  framework: { id: 'lep-orientation-framework', title: 'Program Framework', type: 'read' },
  access: { id: 'lep-orientation-access', title: 'Program Access Essentials', type: 'read' },
  schedule: { id: 'lep-orientation-schedule', title: 'Program Schedule', type: 'read' },
  // day-1 (open to register)
  promises: { id: 'lep-day1-promises', title: 'Promises and Agreements', type: 'form' },
  beliefs: { id: 'lep-day1-beliefs', title: 'A-Game Self Awareness — Beliefs', type: 'form' },
  agame: { id: 'lep-day1-agame-table', title: 'A-Game Table — daily ritual', type: 'form' },
  errc: { id: 'lep-day1-errc', title: 'ERRC Table', type: 'form' },
  crucible: { id: 'lep-day1-crucible', title: 'Crucibles of Leadership', type: 'form' },
  day1: { id: 'lep-day1-assignment', title: 'Day 1 Assignment', type: 'file' },
  // day-2 (paid only)
  day2codesef: { id: 'lep-day2-codesef', title: 'CoDeSeF', type: 'form' },
  responding: { id: 'lep-day2-responding', title: 'Powerful Extreme Responding', type: 'form' },
  relationships: {
    id: 'lep-day2-relationships',
    title: 'Maximise Key Relationships',
    type: 'form',
  },
  purposePeg: { id: 'lep-day2-purpose-peg', title: 'Purpose Peg Table', type: 'form' },
  day2: { id: 'lep-day2-assignment', title: 'Day 2 Assignment', type: 'file' },
  feedback12: { id: 'lep-day3-feedback', title: 'Feedback for Days 1–2', type: 'form' },
  // week-1 (paid only)
  roadmapSample: {
    id: 'lep-day4-roadmap-sample',
    title: '0.5% League Roadmap — worked sample',
    type: 'read',
  },
  roadmap: { id: 'lep-day4-roadmap', title: 'Your 0.5% League Roadmap', type: 'form' },
  brandFeedback: {
    id: 'lep-day4-feedback',
    title: 'Feedback — Differentiated Brand Statement',
    type: 'form',
  },
  weekly1: { id: 'lep-weekly-1', title: 'Week 1 Engagement Form', type: 'form' },
  challenge1: { id: 'lep-challenge-1', title: 'Challenge for Week 1', type: 'form' },
  // week-2 (paid only)
  principles: { id: 'lep-day3-27-principles', title: '27 Principles', type: 'video' },
  rituals: { id: 'lep-day3-5-rituals', title: 'Practising the 5 Rituals', type: 'video' },
  brandRoadmap: {
    id: 'lep-day3-brand-roadmap',
    title: 'Differentiated Brand and the 0.5% League Roadmap',
    type: 'video',
  },
  mentors: { id: 'lep-day3-mentors', title: 'Finding and Working with Mentors', type: 'video' },
  maxValue: { id: 'lep-day3-max-value', title: 'Getting Maximum Value from LEP', type: 'video' },
  linkedin: { id: 'lep-resume-linkedin', title: 'Build your LinkedIn Profile', type: 'form' },
  resumeStudy: {
    id: 'lep-resume-template-study',
    title: 'Resume Template and Samples',
    type: 'read',
  },
  bootcamp: { id: 'lep-resume-bootcamp', title: 'Jobseekers Bootcamp', type: 'video' },
  resume: { id: 'lep-resume-prepare', title: 'Prepare your Resume', type: 'file' },
  pitchPrep: { id: 'lep-day5-instructions', title: 'Shameless Pitch — preparation', type: 'read' },
  pitch: { id: 'lep-day5-pitch', title: 'Your Shameless Pitch', type: 'video' },
  pitchFeedback: { id: 'lep-day5-feedback', title: 'Feedback — Shameless Pitching', type: 'form' },
  weekly2: { id: 'lep-weekly-2', title: 'Week 2 Engagement Form', type: 'form' },
  challenge2: { id: 'lep-challenge-2', title: 'Challenge for Week 2', type: 'form' },
  // week-3 (paid only)
  review: { id: 'lep-day7-review', title: 'Progress Review', type: 'form' },
  guidingStars: { id: 'lep-day6-guiding-stars', title: 'Guiding Stars', type: 'form' },
  starsFeedback: { id: 'lep-day6-feedback', title: 'Feedback — Guiding Stars', type: 'form' },
  weekly3: { id: 'lep-weekly-3', title: 'Week 3 Engagement Form', type: 'form' },
  challenge3: { id: 'lep-challenge-3', title: 'Challenge for Week 3', type: 'form' },
  // week-4 (paid only)
  graduation: { id: 'lep-day8-preparation', title: 'Graduation Preparations', type: 'read' },
  alumni: { id: 'lep-day8-alumni', title: 'Join the Iron Lady Alumni', type: 'form' },
  gradFeedback: { id: 'lep-day8-feedback', title: 'Graduation Feedback', type: 'form' },
  weekly4: { id: 'lep-weekly-4', title: 'Week 4 Engagement Form', type: 'form' },
  weekly5: { id: 'lep-weekly-5', title: 'Week 5 Engagement Form', type: 'form' },
  challenge4: { id: 'lep-challenge-4', title: 'Challenge for Week 4', type: 'form' },
  // community / evaluation / certificate (paid only)
  communitySchedule: {
    id: 'lep-community-schedule',
    title: 'Community Sessions Schedule',
    type: 'read',
  },
  handholding: {
    id: 'lep-community-handholding',
    title: 'Weekly Handholding Sessions',
    type: 'read',
  },
  quizRituals: { id: 'lep-quiz-5-rituals', title: '5 Daily Rituals — Quiz', type: 'quiz' },
  quizPrinciples: { id: 'lep-quiz-27-principles', title: '27 Principles — Quiz', type: 'quiz' },
  attendance: { id: 'lep-attendance', title: 'Attendance', type: 'read' },
  certification: { id: 'lep-certification', title: 'LEP Certification', type: 'read' },
};

const OPEN_TO_REGISTER = new Set(
  [
    T.via,
    T.codesef,
    T.nsdc,
    T.framework,
    T.access,
    T.schedule,
    T.promises,
    T.beliefs,
    T.agame,
    T.errc,
    T.crucible,
    T.day1,
  ].map((t) => t.id)
);

// Every task in a phase with openRegistered: false.
const PAID_ONLY = Object.values(T)
  .map((t) => t.id)
  .filter((id) => !OPEN_TO_REGISTER.has(id));

const due = (task, extra = {}) => ({ taskId: task.id, title: task.title, done: false, ...extra });
const doneDue = (task) => ({ taskId: task.id, title: task.title, done: true });

const scenarios = [
  // ── First login ────────────────────────────────────────────────
  {
    id: 'onboard-lep-registered',
    note: 'First login, LEP part-paid, city + role known',
    context: ctx({
      uid: 's1',
      firstLogin: true,
      pay: PAY.REGISTER,
      location: 'Pune',
      domain: 'HR',
      nextTask: T.via,
      total: 12,
    }),
    expect: {
      job: 'onboard',
      taskId: T.via.id,
      mention: [['Priya'], NAMES, ['VIA']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'onboard-lep-no-name',
    note: 'First login, no name on profile',
    context: ctx({ uid: 's2', firstLogin: true, name: null, nextTask: T.via }),
    expect: {
      job: 'onboard',
      taskId: T.via.id,
      mention: [NAMES, ['VIA']],
      avoid: ['undefined', 'null'],
    },
  },

  // ── Home: next step priority ───────────────────────────────────
  {
    id: 'home-session-tomorrow',
    note: 'Day 2 session tomorrow — the session is the next step',
    context: ctx({
      uid: 's5',
      pct: 40,
      done: 8,
      nextTask: T.day1,
      lepBatch: { nextSessionTitle: 'Full Day — Day 2', nextSessionWhen: 'Sun 26 Oct, 9:00 AM' },
      upcomingEvent: { id: 'S2', title: 'Full Day — Day 2', body: 'Sun 26 Oct · 9:00 AM' },
      lepPractice: practice(2, 2, 3),
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Day 2'], ['Sun 26 Oct', '9:00 AM', 'tomorrow']],
    },
  },
  {
    id: 'home-urgent-due',
    note: 'Urgent due beats practice',
    context: ctx({
      uid: 's6',
      pct: 55,
      done: 11,
      nextTask: T.promises,
      dues: [due(T.day1, { urgent: true })],
      lepPractice: practice(0, 2, 1),
    }),
    expect: { job: 'nudge', taskId: T.day1.id, mention: [['Day 1 Assignment']] },
  },
  {
    id: 'home-practice-left',
    note: 'Practice left today, no dues',
    context: ctx({
      uid: 's7',
      pct: 60,
      done: 12,
      nextTask: T.roadmap,
      dues: [],
      lepPractice: practice(1, 3, 4),
    }),
    expect: { job: 'nudge', taskId: null, mention: [['practice', 'ritual']] },
  },
  {
    id: 'home-open-due-practice-done',
    note: 'Practice done, a normal due is open',
    context: ctx({
      uid: 's8',
      pct: 50,
      done: 10,
      nextTask: T.promises,
      dues: [due(T.roadmap)],
      lepPractice: practice(3, 3, 6),
    }),
    expect: { job: 'nudge', taskId: T.roadmap.id, mention: [['0.5% League Roadmap', 'Roadmap']] },
  },
  {
    id: 'home-next-journey-task',
    note: 'Nothing due, practice done — next journey task',
    context: ctx({
      uid: 's9',
      pct: 30,
      done: 6,
      nextTask: T.codesef,
      dues: [],
      lepPractice: practice(2, 2, 2),
    }),
    expect: { job: 'nudge', taskId: T.codesef.id, mention: [['CoDeSeF']] },
  },
  {
    id: 'home-due-already-done',
    note: 'Next task in journey is already done in dues — must not be suggested',
    context: ctx({
      uid: 's10',
      pct: 45,
      done: 9,
      nextTask: T.day1,
      dues: [doneDue(T.day1), due(T.roadmap)],
      lepPractice: practice(2, 2, 2),
    }),
    expect: {
      job: 'nudge',
      taskId: T.roadmap.id,
      mention: [['Roadmap']],
      avoid: ['Day 1 Assignment'],
    },
  },
  {
    id: 'home-all-clear',
    note: 'Everything done today — celebrate and point at next session',
    context: ctx({
      uid: 's11',
      pct: 70,
      done: 14,
      dues: [],
      lepPractice: practice(3, 3, 9),
      lepBatch: { nextSessionTitle: 'Shameless Pitch', nextSessionWhen: 'Thu 6 Nov, 6:30 PM' },
    }),
    expect: { job: 'nudge', taskId: null, mention: [['Shameless Pitch']] },
  },
  {
    id: 'home-registered-locked',
    note: 'Part-paid learner — never send her to a paid-only task',
    context: ctx({
      uid: 's12',
      pay: PAY.REGISTER,
      pct: 80,
      done: 8,
      total: 10,
      nextTask: T.day1,
      lepPractice: practice(1, 1, 1, false),
    }),
    expect: { job: 'nudge', taskId: T.day1.id, mention: [['Day 1']], lockedTaskIds: PAID_ONLY },
  },
  {
    id: 'home-rituals-locked',
    note: 'Rituals not unlocked yet — must not push rituals',
    context: ctx({
      uid: 's13',
      pct: 20,
      done: 4,
      nextTask: T.promises,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: { job: 'nudge', taskId: T.promises.id, mention: [['Promises']], avoid: ['ritual'] },
  },

  // ── Performance-aware tone ─────────────────────────────────────
  {
    id: 'tone-at-risk',
    note: 'Inactive 6 days, well behind batch — warm, one small step, no guilt',
    context: ctx({
      uid: 's14',
      pct: 15,
      done: 3,
      nextTask: T.codesef,
      lepPractice: practice(0, 2, 0),
      performance: perf('at-risk', { tasksDone: 3, batchMedianDone: 9 }),
    }),
    // Either today's practice or CoDeSeF is a fair small step, so the step itself is not scored.
    expect: {
      job: 'nudge',
      mention: [['practice', 'ritual', 'CoDeSeF', 'minute', 'small']],
      avoid: GUILT,
    },
  },
  {
    id: 'tone-slipping',
    note: 'Behind batch median — encourage + one concrete step',
    context: ctx({
      uid: 's15',
      pct: 35,
      done: 7,
      nextTask: T.day1,
      dues: [due(T.day1)],
      lepPractice: practice(2, 2, 1),
      performance: perf('slipping', {
        daysInactive: 1,
        tasksDone: 7,
        tasksOpen: 11,
        batchMedianDone: 10,
      }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.day1.id,
      mention: [['Day 1 Assignment']],
      avoid: ['failed', 'disappoint'],
    },
  },
  {
    id: 'tone-star',
    note: 'Ahead of batch, 12-day streak — affirm + stretch',
    context: ctx({
      uid: 's16',
      pct: 85,
      done: 17,
      nextTask: T.pitch,
      dues: [],
      lepPractice: practice(3, 3, 12),
      performance: perf('star', { tasksDone: 17, tasksOpen: 18, batchMedianDone: 11 }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.pitch.id,
      mention: [
        ['Shameless Pitch', 'Pitch'],
        ['streak', 'ahead', 'stretch', 'challenge', 'next level', 'consistent'],
      ],
    },
  },
  {
    id: 'tone-on-track',
    note: 'On track — affirm + next step',
    context: ctx({
      uid: 's17',
      pct: 50,
      done: 10,
      nextTask: T.roadmap,
      dues: [],
      lepPractice: practice(2, 2, 5),
      performance: perf('on-track', { tasksDone: 10, tasksOpen: 12, batchMedianDone: 10 }),
    }),
    expect: { job: 'nudge', taskId: T.roadmap.id, mention: [['Roadmap']] },
  },
  {
    id: 'tone-missed-session',
    note: 'Missed Day 1 — catch up via recording, no guilt',
    context: ctx({
      uid: 's18',
      pct: 25,
      done: 5,
      nextTask: T.day1,
      lepPractice: practice(0, 0, 0, false),
      performance: perf('slipping', {
        daysInactive: 3,
        missedSessions: ['Full Day Session — Day 1'],
        tasksDone: 5,
        tasksOpen: 9,
      }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.day1.id,
      mention: [['Day 1']],
      avoid: ['you missed', 'absent', 'failed'],
    },
  },

  // ── Learn surface ──────────────────────────────────────────────
  {
    id: 'learn-recommend-next',
    note: 'Learn tab recommends the next task',
    context: ctx({ uid: 's19', surface: 'learn', pct: 40, done: 8, nextTask: T.resume }),
    expect: { job: 'recommend', taskId: T.resume.id, mention: [['Resume']] },
  },
  {
    id: 'learn-all-done',
    note: 'Learn tab, everything cleared',
    context: ctx({ uid: 's20', surface: 'learn', pct: 100, done: 20 }),
    expect: {
      job: 'recommend',
      taskId: null,
      mention: [['cleared', 'complete', 'done', 'caught up']],
    },
  },

  // ── Community surface ──────────────────────────────────────────
  {
    id: 'community-default',
    note: 'Engage tab — invite to share with the cohort',
    context: ctx({ uid: 's23', surface: 'community', pct: 40, done: 8 }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'share', 'post', 'community']],
    },
  },
  {
    id: 'community-at-risk',
    note: 'Engage tab, inactive learner — gentle reconnect',
    context: ctx({
      uid: 's24',
      surface: 'community',
      pct: 10,
      done: 2,
      performance: perf('at-risk', { daysInactive: 8, tasksDone: 2, tasksOpen: 9 }),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'community', 'women']],
      avoid: GUILT,
    },
  },

  // ── Edge cases ─────────────────────────────────────────────────
  {
    id: 'edge-zero-progress',
    note: 'Day one, 0% — must not say "0%"',
    context: ctx({
      uid: 's25',
      pct: 0,
      done: 0,
      nextTask: T.via,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: { job: 'nudge', taskId: T.via.id, mention: [['VIA']], avoid: ['0%'] },
  },
  {
    id: 'edge-long-name',
    note: 'Full name with initials — use first name only',
    context: ctx({
      uid: 's26',
      name: 'Dr. Meenakshi S. Narayanan',
      pct: 30,
      done: 6,
      nextTask: T.codesef,
    }),
    expect: {
      job: 'nudge',
      taskId: T.codesef.id,
      mention: [['Meenakshi'], ['CoDeSeF']],
      avoid: ['Dr.,', 'Narayanan,'],
    },
  },
  {
    id: 'edge-no-next-no-batch',
    note: 'No next task, no batch info — no invented session or date',
    context: ctx({ uid: 's27', pct: 100, done: 20, dues: [] }),
    expect: { job: 'nudge', taskId: null, mention: [['done', 'complete', 'caught up', 'clear']] },
  },
  {
    id: 'edge-graduation-week',
    note: 'Week 4 — graduation preparation',
    context: ctx({
      uid: 's28',
      pct: 92,
      done: 23,
      total: 25,
      nextTask: T.graduation,
      dues: [],
      lepPractice: practice(3, 3, 20),
      lepBatch: {
        nextSessionTitle: 'Graduation (Certification)',
        nextSessionWhen: 'Sat 15 Nov, 7:30 PM',
      },
    }),
    expect: { job: 'nudge', taskId: T.graduation.id, mention: [['Graduation']] },
  },

  // ── Part-paid vs full, phase by phase ──────────────────────────
  {
    id: 'pay-register-preprogram',
    note: 'Part-paid, pre-program: CoDeSeF sheet next',
    context: ctx({
      uid: 'l1',
      pay: PAY.REGISTER,
      pct: 10,
      done: 1,
      total: 12,
      nextTask: T.codesef,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: {
      job: 'nudge',
      taskId: T.codesef.id,
      mention: [['CoDeSeF']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'pay-paid-preprogram',
    note: 'Full payment, pre-program: NSDC registration next',
    context: ctx({
      uid: 'l2',
      pct: 8,
      done: 2,
      nextTask: T.nsdc,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: { job: 'nudge', taskId: T.nsdc.id, mention: [['NSDC']] },
  },
  {
    id: 'pay-register-orientation',
    note: 'Part-paid, orientation phase: Program Framework next',
    context: ctx({
      uid: 'l3',
      pay: PAY.REGISTER,
      pct: 30,
      done: 4,
      total: 12,
      nextTask: T.framework,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: {
      job: 'nudge',
      taskId: T.framework.id,
      mention: [['Program Framework', 'Framework']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'pay-paid-orientation-session-tonight',
    note: 'Full payment, Orientation tonight — the session wins',
    context: ctx({
      uid: 'l4',
      pct: 12,
      done: 3,
      nextTask: T.schedule,
      lepPractice: practice(0, 0, 0, false),
      lepBatch: { nextSessionTitle: 'Orientation (B/W)', nextSessionWhen: 'Thu 23 Oct, 7:00 PM' },
      upcomingEvent: { id: 'S0', title: 'Orientation (B/W)', body: 'Thu 23 Oct · 7:00 PM' },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Orientation'], ['7:00 PM', 'Thu 23 Oct', 'tonight', 'today']],
    },
  },
  {
    id: 'pay-register-day1',
    note: 'Part-paid, Day 1 phase: ERRC Table next',
    context: ctx({
      uid: 'l5',
      pay: PAY.REGISTER,
      pct: 60,
      done: 7,
      total: 12,
      nextTask: T.errc,
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: { job: 'nudge', taskId: T.errc.id, mention: [['ERRC']], lockedTaskIds: PAID_ONLY },
  },
  {
    id: 'pay-register-all-open-done',
    note: 'Part-paid, every open task done — next step is completing enrollment, no amount',
    context: ctx({
      uid: 'l6',
      pay: PAY.REGISTER,
      pct: 100,
      done: 12,
      total: 12,
      dues: [],
      lepPractice: practice(0, 0, 0, false),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [CONTINUE_JOURNEY],
      avoid: ['₹', 'rs.', 'inr', 'payment failed'],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'pay-register-all-done-learn',
    note: 'Part-paid on Learn, open tasks cleared — point at enrollment, not a locked lesson',
    context: ctx({ uid: 'l7', surface: 'learn', pay: PAY.REGISTER, pct: 100, done: 12, total: 12 }),
    expect: {
      job: 'recommend',
      taskId: null,
      mention: [CONTINUE_JOURNEY],
      avoid: ['₹', 'Day 2 Assignment', 'Shameless Pitch'],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'pay-paid-day2',
    note: 'Full payment, Day 2 done live — Day 2 Assignment due',
    context: ctx({
      uid: 'l8',
      pct: 38,
      done: 13,
      total: 34,
      nextTask: T.purposePeg,
      dues: [due(T.day2, { mandatory: true })],
      lepPractice: practice(2, 2, 1),
    }),
    expect: { job: 'nudge', taskId: T.day2.id, mention: [['Day 2 Assignment']] },
  },
  {
    id: 'pay-paid-week1',
    note: 'Full payment, Week 1: Week 1 Engagement Form due, practice done',
    context: ctx({
      uid: 'l9',
      pct: 48,
      done: 17,
      total: 34,
      nextTask: T.roadmapSample,
      dues: [due(T.weekly1)],
      lepPractice: practice(3, 3, 4),
    }),
    expect: {
      job: 'nudge',
      taskId: T.weekly1.id,
      mention: [['Week 1 Engagement Form', 'Engagement Form']],
    },
  },
  {
    id: 'pay-paid-week2-linkedin',
    note: 'Full payment, Week 2: LinkedIn profile next',
    context: ctx({
      uid: 'l10',
      pct: 60,
      done: 22,
      total: 37,
      nextTask: T.linkedin,
      dues: [],
      lepPractice: practice(3, 3, 8),
    }),
    expect: { job: 'nudge', taskId: T.linkedin.id, mention: [['LinkedIn']] },
  },
  {
    id: 'pay-paid-week3',
    note: 'Full payment, Week 3: Guiding Stars due before Progress Check',
    context: ctx({
      uid: 'l11',
      pct: 72,
      done: 28,
      total: 39,
      nextTask: T.review,
      dues: [due(T.guidingStars, { urgent: true })],
      lepPractice: practice(1, 3, 10),
    }),
    expect: { job: 'nudge', taskId: T.guidingStars.id, mention: [['Guiding Stars']] },
  },
  {
    id: 'pay-paid-week4-quiz',
    note: 'Full payment, Week 4: 5 Daily Rituals quiz before certification',
    context: ctx({
      uid: 'l12',
      pct: 90,
      done: 45,
      total: 50,
      nextTask: T.quizRituals,
      dues: [],
      lepPractice: practice(3, 3, 22),
    }),
    expect: { job: 'nudge', taskId: T.quizRituals.id, mention: [['Quiz']] },
  },
  {
    id: 'pay-paid-session-within-24h',
    note: 'Full payment, Shameless Pitch session in a few hours — session beats the open due',
    context: ctx({
      uid: 'l13',
      pct: 62,
      done: 23,
      total: 37,
      nextTask: T.pitchFeedback,
      dues: [due(T.weekly2)],
      lepPractice: practice(3, 3, 9),
      lepBatch: { nextSessionTitle: 'Shameless Pitch', nextSessionWhen: 'Thu 6 Nov, 6:30 PM' },
      upcomingEvent: { id: 'S5', title: 'Shameless Pitch', body: 'Thu 6 Nov · 6:30 PM' },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Shameless Pitch'], ['6:30 PM', 'Thu 6 Nov', 'today', 'tonight']],
    },
  },
  {
    id: 'pay-paid-graduation-session',
    note: 'Full payment, Graduation tomorrow — session wins over the open form',
    context: ctx({
      uid: 'l14',
      pct: 96,
      done: 48,
      total: 50,
      nextTask: T.alumni,
      dues: [due(T.weekly4)],
      lepPractice: practice(3, 3, 25),
      lepBatch: {
        nextSessionTitle: 'Graduation (Certification)',
        nextSessionWhen: 'Sat 15 Nov, 7:30 PM',
      },
      upcomingEvent: {
        id: 'S8',
        title: 'Graduation (Certification)',
        body: 'Sat 15 Nov · 7:30 PM',
      },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Graduation'], ['7:30 PM', 'Sat 15 Nov', 'tomorrow']],
    },
  },

  // ── Late joiners ───────────────────────────────────────────────
  {
    id: 'late-first-login-after-day1',
    note: 'Joins after Day 1 already happened — warm welcome, oldest mandatory item',
    context: ctx({
      uid: 'j1',
      firstLogin: true,
      pct: 0,
      done: 0,
      total: 34,
      nextTask: T.via,
      dues: [due(T.via, { mandatory: true }), due(T.day1, { mandatory: true })],
      enrollment: lateJoin(3, ['Orientation (B/W)', 'Full Day Session — Day 1']),
    }),
    expect: {
      job: 'onboard',
      taskId: T.via.id,
      mention: [['Priya'], NAMES, ['VIA']],
      avoid: [...GUILT, 'Day 1 Assignment'],
    },
  },
  {
    id: 'late-week1-mandatory-backlog',
    note: 'Joined in Week 1 with Day 1 + Day 2 assignments open — oldest mandatory first, one step only',
    context: ctx({
      uid: 'j2',
      pct: 20,
      done: 6,
      total: 34,
      nextTask: T.roadmap,
      dues: [due(T.day1, { mandatory: true }), due(T.day2, { mandatory: true }), due(T.weekly1)],
      lepPractice: practice(0, 2, 0),
      enrollment: lateJoin(5, [
        'Orientation (B/W)',
        'Full Day Session — Day 1',
        'Full Day Session — Day 2',
      ]),
      performance: perf('slipping', { tasksDone: 6, tasksOpen: 17, batchMedianDone: 14 }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.day1.id,
      mention: [['Day 1 Assignment']],
      avoid: [...GUILT, 'Day 2 Assignment', 'Week 1 Engagement Form'],
    },
  },
  {
    id: 'late-register-backlog',
    note: 'Late joiner, part-paid — catch up only on what she can open',
    context: ctx({
      uid: 'j3',
      pay: PAY.REGISTER,
      pct: 25,
      done: 3,
      total: 12,
      nextTask: T.crucible,
      dues: [due(T.codesef, { mandatory: true }), due(T.day1, { mandatory: true })],
      lepPractice: practice(0, 0, 0, false),
      enrollment: lateJoin(4, ['Orientation (B/W)', 'Full Day Session — Day 1']),
    }),
    expect: {
      job: 'nudge',
      taskId: T.codesef.id,
      mention: [['CoDeSeF']],
      avoid: [...GUILT, 'Day 1 Assignment'],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'late-session-within-24h',
    note: 'Late joiner with a backlog, Closure session tonight — the session still wins',
    context: ctx({
      uid: 'j4',
      pct: 22,
      done: 7,
      total: 34,
      nextTask: T.roadmap,
      dues: [due(T.day1, { mandatory: true }), due(T.day2, { mandatory: true })],
      lepPractice: practice(0, 2, 0),
      lepBatch: {
        nextSessionTitle: 'Closure Session (Completion & Review)',
        nextSessionWhen: 'Tue 28 Oct, 7:00 PM',
      },
      upcomingEvent: {
        id: 'S3',
        title: 'Closure Session (Completion & Review)',
        body: 'Tue 28 Oct · 7:00 PM',
      },
      enrollment: lateJoin(3, [
        'Orientation (B/W)',
        'Full Day Session — Day 1',
        'Full Day Session — Day 2',
      ]),
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Closure'], ['7:00 PM', 'Tue 28 Oct', 'tonight', 'today']],
      avoid: GUILT,
    },
  },
  {
    id: 'late-learn-tab',
    note: 'Late joiner on Learn — recommend the oldest mandatory catch-up, not the current week',
    context: ctx({
      uid: 'j5',
      surface: 'learn',
      pct: 18,
      done: 6,
      total: 34,
      nextTask: T.weekly1,
      dues: [due(T.day1, { mandatory: true }), due(T.weekly1)],
      enrollment: lateJoin(6, [
        'Orientation (B/W)',
        'Full Day Session — Day 1',
        'Full Day Session — Day 2',
      ]),
    }),
    expect: {
      job: 'recommend',
      taskId: T.day1.id,
      mention: [['Day 1 Assignment']],
      avoid: [...GUILT, 'Week 1 Engagement Form'],
    },
  },
  {
    id: 'late-community',
    note: 'Late joiner on Engage — introduce herself to the batch, no guilt',
    context: ctx({
      uid: 'j6',
      surface: 'community',
      pct: 10,
      done: 3,
      total: 34,
      enrollment: lateJoin(7, [
        'Orientation (B/W)',
        'Full Day Session — Day 1',
        'Full Day Session — Day 2',
      ]),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'community', 'introduce', 'women']],
      avoid: GUILT,
    },
  },
  {
    id: 'late-at-risk',
    note: 'Joined late and went quiet for a week — warm reconnect, one small step',
    context: ctx({
      uid: 'j7',
      pct: 9,
      done: 3,
      total: 34,
      nextTask: T.day1,
      dues: [due(T.day1, { mandatory: true }), due(T.day2, { mandatory: true })],
      lepPractice: practice(0, 2, 0),
      enrollment: lateJoin(8, [
        'Orientation (B/W)',
        'Full Day Session — Day 1',
        'Full Day Session — Day 2',
      ]),
      performance: perf('at-risk', {
        daysInactive: 7,
        tasksDone: 3,
        tasksOpen: 20,
        batchMedianDone: 16,
      }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.day1.id,
      mention: [['Day 1 Assignment', 'Day 1']],
      avoid: [...GUILT, 'Day 2 Assignment'],
    },
  },

  // ── Performance segments on every surface ──────────────────────
  {
    id: 'seg-star-learn',
    note: 'Star on Learn — stretch recommendation',
    context: ctx({
      uid: 'p1',
      surface: 'learn',
      pct: 80,
      done: 30,
      total: 37,
      nextTask: T.mentors,
      performance: perf('star', { tasksDone: 30, tasksOpen: 31, batchMedianDone: 22 }),
    }),
    expect: { job: 'recommend', taskId: T.mentors.id, mention: [['Mentors']] },
  },
  {
    id: 'seg-at-risk-learn',
    note: 'At-risk on Learn — one small lesson, no guilt',
    context: ctx({
      uid: 'p2',
      surface: 'learn',
      pct: 12,
      done: 4,
      total: 34,
      nextTask: T.beliefs,
      performance: perf('at-risk', { daysInactive: 9, tasksDone: 4, batchMedianDone: 15 }),
    }),
    expect: {
      job: 'recommend',
      taskId: T.beliefs.id,
      mention: [['Beliefs', 'A-Game']],
      avoid: GUILT,
    },
  },
  {
    id: 'seg-slipping-learn',
    note: 'Slipping on Learn — one concrete lesson',
    context: ctx({
      uid: 'p3',
      surface: 'learn',
      pct: 40,
      done: 14,
      total: 37,
      nextTask: T.principles,
      performance: perf('slipping', { tasksDone: 14, batchMedianDone: 19 }),
    }),
    expect: {
      job: 'recommend',
      taskId: T.principles.id,
      mention: [['27 Principles']],
      avoid: ['failed', 'disappoint'],
    },
  },
  {
    id: 'seg-on-track-learn',
    note: 'On track on Learn',
    context: ctx({
      uid: 'p4',
      surface: 'learn',
      pct: 55,
      done: 20,
      total: 37,
      nextTask: T.bootcamp,
      performance: perf('on-track', { tasksDone: 20, batchMedianDone: 20 }),
    }),
    expect: {
      job: 'recommend',
      taskId: T.bootcamp.id,
      mention: [['Jobseekers Bootcamp', 'Bootcamp']],
    },
  },
  {
    id: 'seg-star-community',
    note: 'Star on Engage — invite her to share a win with the batch',
    context: ctx({
      uid: 'p5',
      surface: 'community',
      pct: 85,
      done: 32,
      total: 37,
      performance: perf('star', { tasksDone: 32, batchMedianDone: 22 }),
    }),
    expect: { job: 'nudge', taskId: null, mention: [['share', 'post', 'win', 'cohort', 'batch']] },
  },
  {
    id: 'seg-slipping-community',
    note: 'Slipping on Engage — ask the batch, no guilt',
    context: ctx({
      uid: 'p6',
      surface: 'community',
      pct: 30,
      done: 11,
      total: 37,
      performance: perf('slipping', { tasksDone: 11, batchMedianDone: 18 }),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'community', 'ask', 'question']],
      avoid: GUILT,
    },
  },
  {
    id: 'seg-on-track-community',
    note: 'On track on Engage',
    context: ctx({
      uid: 'p7',
      surface: 'community',
      pct: 50,
      done: 18,
      total: 37,
      performance: perf('on-track', { tasksDone: 18, batchMedianDone: 18 }),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'share', 'post', 'community']],
    },
  },
];

module.exports = scenarios;
module.exports.TASKS = T;
module.exports.PAID_ONLY = PAID_ONLY;
