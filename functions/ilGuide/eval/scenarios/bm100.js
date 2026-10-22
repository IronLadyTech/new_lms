/**
 * 100BM golden scenarios — 24-week program, weekly live sessions.
 * Onboarding is open on part payment; Phase 1–4 and Graduation need full payment.
 * 100BM has no LEP-style daily practice, so no lepPractice here.
 */
const {
  CONTINUE_JOURNEY,
  PAY,
  PROGRAMS,
  PROGRAM_NAMES,
  GUILT,
  ctx,
  perf,
  lateJoin,
} = require('./shared');

const BM = PROGRAMS.BM;
const NAMES = PROGRAM_NAMES['100bm'];

const T = {
  coreStory: { id: 'bm100-wk1-4', title: 'Core Story Practice Session', type: 'video' },
  milestone: { id: 'bm100-wk1-1', title: 'Milestone Table Practice Session', type: 'form' },
  brandVideo: { id: 'bm100-onb-brand-video', title: 'Brand Creation Video', type: 'video' },
  resume: { id: 'bm100-onb-resume', title: 'Resume Preparation', type: 'file' },
  image: { id: 'bm100-wk1', title: 'Session 1 — Board Member Image Creation', type: 'video' },
  imperfect: { id: 'bm100-wk2', title: 'Imperfect Brand Video Session', type: 'video' },
  diffBrand: { id: 'bm100-wk3', title: 'Resume and Differentiated Brand', type: 'file' },
  midLevel: {
    id: 'bm100-wk4',
    title: 'Session 2 — Mid Level Performance Excellence',
    type: 'video',
  },
  theme: { id: 'bm100-wk5', title: 'Theme Management', type: 'form' },
  preCapability: { id: 'bm100-wk6', title: 'Pre Session on Capability Matrix', type: 'form' },
  superPower: {
    id: 'bm100-wk7',
    title: 'Session 3 — Leadership Super Power & Capability Matrix',
    type: 'video',
  },
  postCapability: { id: 'bm100-wk8', title: 'Post Session on Capability Matrix', type: 'form' },
  prePitch: { id: 'bm100-wk9', title: 'Pre-Session on Pitch', type: 'form' },
  pitching: {
    id: 'bm100-wk10',
    title: 'Session 4 — Pitching and Influencing Tactics',
    type: 'video',
  },
  postPitch: { id: 'bm100-wk11', title: 'Post-Session on Pitch', type: 'form' },
  politics: { id: 'bm100-wk13', title: 'Session 5 — Mid-Level Politics Management', type: 'video' },
  strategic: { id: 'bm100-wk16', title: 'Session 6 — Strategic Outlook', type: 'video' },
  strategyReview: { id: 'bm100-strategy-review', title: 'Strategy Review Session', type: 'video' },
  mock: { id: 'bm100-wk17', title: 'Mock Interview', type: 'video' },
  linkedinPrep: {
    id: 'bm100-linkedin-prep',
    title: 'Prep of LinkedIn Brand Video Challenge',
    type: 'video',
  },
  linkedinShow: { id: 'bm100-wk18', title: 'Showcasing — LinkedIn Brand Video', type: 'video' },
  ceo: { id: 'bm100-wk23', title: 'Showcasing — Speak Like a CEO Challenge', type: 'video' },
  wtbPrep: { id: 'bm100-wk24', title: 'Pitch Video Challenge — WTB Preparation', type: 'video' },
  walkToBoard: {
    id: 'bm100-walk-to-board',
    title: 'Walk to Board — Present to External Leader',
    type: 'video',
  },
  graduation: { id: 'bm100-wk26', title: 'Graduation Ceremony', type: 'event' },
};

const ONBOARDING = [T.coreStory, T.milestone, T.brandVideo, T.resume].map((t) => t.id);
const PAID_ONLY = Object.values(T)
  .map((t) => t.id)
  .filter((id) => !ONBOARDING.includes(id));

const NO_AMOUNT = ['₹', 'Rs.', 'INR', 'rupees'];
const ENROLL = [CONTINUE_JOURNEY];

const bm = (o) => ctx({ program: BM, name: 'Anita Rao', total: 28, ...o });
const due = (t, extra = {}) => ({ taskId: t.id, title: t.title, done: false, ...extra });
const session = (title, when) => ({ batch: { nextSessionTitle: title, nextSessionWhen: when } });

module.exports = [
  // ── First login ────────────────────────────────────────────────
  {
    id: 'bm-onboard-register',
    note: 'First login, 100BM part-paid, city + role known',
    context: bm({
      uid: 'b1',
      firstLogin: true,
      pay: PAY.REGISTER,
      location: 'Bengaluru',
      domain: 'Finance',
      nextTask: T.coreStory,
      total: 4,
    }),
    expect: {
      job: 'onboard',
      taskId: T.coreStory.id,
      mention: [['Anita'], NAMES, ['Core Story']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'bm-onboard-paid',
    note: 'First login, 100BM full payment',
    context: bm({ uid: 'b2', firstLogin: true, nextTask: T.coreStory }),
    expect: { job: 'onboard', taskId: T.coreStory.id, mention: [['Anita'], NAMES, ['Core Story']] },
  },
  {
    id: 'bm-onboard-no-name',
    note: 'First login, no name on profile',
    context: bm({
      uid: 'b3',
      firstLogin: true,
      name: null,
      pay: PAY.REGISTER,
      nextTask: T.coreStory,
      total: 4,
    }),
    expect: {
      job: 'onboard',
      taskId: T.coreStory.id,
      mention: [NAMES, ['Core Story']],
      avoid: ['undefined', 'null'],
      lockedTaskIds: PAID_ONLY,
    },
  },

  // ── Part-paid vs full, by phase ───────────────────────────────
  {
    id: 'bm-register-onboarding-mid',
    note: 'Part-paid, halfway through onboarding',
    context: bm({
      uid: 'b4',
      pay: PAY.REGISTER,
      pct: 50,
      done: 2,
      total: 4,
      nextTask: T.brandVideo,
      dues: [],
    }),
    expect: {
      job: 'nudge',
      taskId: T.brandVideo.id,
      mention: [['Brand Creation']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'bm-register-onboarding-done',
    note: 'Part-paid, all onboarding done — next step is completing enrollment',
    context: bm({ uid: 'b5', pay: PAY.REGISTER, pct: 100, done: 4, total: 4, dues: [] }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: ENROLL,
      avoid: NO_AMOUNT,
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'bm-register-learn-done',
    note: 'Part-paid on Learn, onboarding cleared — enrollment, no paid lesson',
    context: bm({ uid: 'b6', surface: 'learn', pay: PAY.REGISTER, pct: 100, done: 4, total: 4 }),
    expect: {
      job: 'recommend',
      taskId: null,
      mention: ENROLL,
      avoid: [...NO_AMOUNT, 'Board Member Image'],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'bm-paid-phase1-start',
    note: 'Full payment, onboarding done, Phase 1 opens',
    context: bm({ uid: 'b7', pct: 15, done: 4, nextTask: T.image, dues: [] }),
    expect: { job: 'nudge', taskId: T.image.id, mention: [['Board Member Image']] },
  },
  {
    id: 'bm-paid-phase1-mid',
    note: 'Phase 1, capability matrix week',
    context: bm({
      uid: 'b8',
      pct: 30,
      done: 9,
      nextTask: T.preCapability,
      dues: [due(T.preCapability)],
    }),
    expect: { job: 'nudge', taskId: T.preCapability.id, mention: [['Capability Matrix']] },
  },
  {
    id: 'bm-paid-phase2',
    note: 'Phase 2, pitching week',
    context: bm({ uid: 'b9', pct: 45, done: 13, nextTask: T.prePitch, dues: [due(T.prePitch)] }),
    expect: { job: 'nudge', taskId: T.prePitch.id, mention: [['Pitch']] },
  },
  {
    id: 'bm-paid-phase3',
    note: 'Phase 3, mock interview',
    context: bm({ uid: 'b10', pct: 65, done: 18, nextTask: T.mock, dues: [] }),
    expect: { job: 'nudge', taskId: T.mock.id, mention: [['Mock Interview']] },
  },
  {
    id: 'bm-paid-phase4',
    note: 'Phase 4, LinkedIn brand video challenge',
    context: bm({
      uid: 'b11',
      pct: 80,
      done: 22,
      nextTask: T.linkedinPrep,
      dues: [due(T.linkedinPrep)],
    }),
    expect: { job: 'nudge', taskId: T.linkedinPrep.id, mention: [['LinkedIn Brand Video']] },
  },
  {
    id: 'bm-paid-graduation',
    note: 'Walk to Board done, graduation ahead',
    context: bm({
      uid: 'b12',
      pct: 96,
      done: 27,
      nextTask: T.graduation,
      dues: [],
      ...session('Graduation Ceremony', 'Sat 21 Mar, 11:00 AM'),
    }),
    expect: { job: 'nudge', taskId: T.graduation.id, mention: [['Graduation']] },
  },

  // ── Next-step priority ─────────────────────────────────────────
  {
    id: 'bm-session-tomorrow',
    note: 'Session 4 tomorrow — the session is the next step',
    context: bm({
      uid: 'b13',
      pct: 40,
      done: 12,
      nextTask: T.prePitch,
      ...session('Session 4 — Pitching and Influencing Tactics', 'Sat 8 Nov, 10:00 AM'),
      upcomingEvent: {
        id: 'bm-s4',
        title: 'Session 4 — Pitching and Influencing Tactics',
        body: 'Sat 8 Nov · 10:00 AM',
      },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Pitching and Influencing'], ['Sat 8 Nov', '10:00 AM', 'tomorrow']],
    },
  },
  {
    id: 'bm-weekly-qa-tonight',
    note: 'Weekly Q&A tonight',
    context: bm({
      uid: 'b14',
      pct: 35,
      done: 10,
      nextTask: T.postCapability,
      upcomingEvent: { id: 'bm-qa', title: 'Weekly Q&A', body: 'Thu 7:00 PM IST' },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [
        ['Weekly Q&A', 'Q&A'],
        ['Thu', '7:00 PM', 'tonight'],
      ],
    },
  },
  {
    id: 'bm-urgent-due',
    note: 'Urgent due beats the next journey task',
    context: bm({
      uid: 'b15',
      pct: 28,
      done: 8,
      nextTask: T.theme,
      dues: [due(T.diffBrand, { urgent: true })],
    }),
    expect: { job: 'nudge', taskId: T.diffBrand.id, mention: [['Differentiated Brand']] },
  },
  {
    id: 'bm-due-already-done',
    note: 'Journey next task already done in dues — point at the open one',
    context: bm({
      uid: 'b16',
      pct: 47,
      done: 13,
      nextTask: T.pitching,
      dues: [{ ...due(T.pitching), done: true }, due(T.postPitch)],
    }),
    expect: {
      job: 'nudge',
      taskId: T.postPitch.id,
      mention: [['Post-Session on Pitch']],
      avoid: ['Pitching and Influencing'],
    },
  },
  {
    id: 'bm-all-clear',
    note: 'Everything done this week — celebrate, point at next session',
    context: bm({
      uid: 'b17',
      pct: 55,
      done: 15,
      dues: [],
      ...session('Session 5 — Mid-Level Politics Management', 'Sat 22 Nov, 10:00 AM'),
    }),
    expect: { job: 'nudge', taskId: null, mention: [['Politics Management']] },
  },

  // ── Late joiners ───────────────────────────────────────────────
  {
    id: 'bm-late-first-login',
    note: 'Joins 3 weeks after start — welcome, oldest mandatory catch-up first',
    context: bm({
      uid: 'b18',
      firstLogin: true,
      pct: 0,
      done: 0,
      nextTask: T.midLevel,
      dues: [
        due(T.coreStory, { mandatory: true }),
        due(T.resume, { mandatory: true }),
        due(T.image, { mandatory: true }),
      ],
      enrollment: lateJoin(21, ['Session 1 — Board Member Image Creation']),
    }),
    expect: {
      job: 'onboard',
      taskId: T.coreStory.id,
      mention: [['Anita'], ['Core Story']],
      avoid: [...GUILT, 'Resume Preparation'],
    },
  },
  {
    id: 'bm-late-register',
    note: 'Late joiner on part payment — catch up onboarding only',
    context: bm({
      uid: 'b19',
      pay: PAY.REGISTER,
      pct: 25,
      done: 1,
      total: 4,
      nextTask: T.milestone,
      dues: [due(T.milestone, { mandatory: true }), due(T.resume, { mandatory: true })],
      enrollment: lateJoin(14, ['Session 1 — Board Member Image Creation']),
    }),
    expect: {
      job: 'nudge',
      taskId: T.milestone.id,
      mention: [['Milestone Table']],
      avoid: GUILT,
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'bm-late-session-tomorrow',
    note: 'Late joiner with backlog, live session tomorrow — the session wins',
    context: bm({
      uid: 'b20',
      pct: 10,
      done: 3,
      nextTask: T.theme,
      dues: [due(T.image, { mandatory: true }), due(T.imperfect, { mandatory: true })],
      enrollment: lateJoin(28, [
        'Session 1 — Board Member Image Creation',
        'Session 2 — Mid Level Performance Excellence',
      ]),
      ...session('Session 3 — Leadership Super Power & Capability Matrix', 'Sat 1 Nov, 10:00 AM'),
      upcomingEvent: {
        id: 'bm-s3',
        title: 'Session 3 — Leadership Super Power & Capability Matrix',
        body: 'Sat 1 Nov · 10:00 AM',
      },
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Leadership Super Power', 'Capability Matrix']],
      avoid: GUILT,
    },
  },
  {
    id: 'bm-late-recording',
    note: 'Late joiner — Session 1 happened before she joined, catch up via recording',
    context: bm({
      uid: 'b21',
      pct: 15,
      done: 4,
      nextTask: T.midLevel,
      dues: [due(T.image, { mandatory: true }), due(T.diffBrand, { mandatory: true })],
      enrollment: lateJoin(18, ['Session 1 — Board Member Image Creation']),
    }),
    expect: {
      job: 'nudge',
      taskId: T.image.id,
      mention: [['Board Member Image', 'recording']],
      avoid: [...GUILT, 'Resume and Differentiated Brand'],
    },
  },
  {
    id: 'bm-late-learn',
    note: 'Late joiner on Learn — one catch-up lesson, not the backlog',
    context: bm({
      uid: 'b22',
      surface: 'learn',
      pct: 12,
      done: 3,
      nextTask: T.preCapability,
      dues: [due(T.imperfect, { mandatory: true }), due(T.diffBrand, { mandatory: true })],
      enrollment: lateJoin(30, [
        'Session 1 — Board Member Image Creation',
        'Session 2 — Mid Level Performance Excellence',
      ]),
    }),
    expect: {
      job: 'recommend',
      taskId: T.imperfect.id,
      mention: [['Imperfect Brand']],
      avoid: [...GUILT, 'Resume and Differentiated Brand'],
    },
  },
  {
    id: 'bm-late-community',
    note: 'Late joiner on Engage — welcome into the cohort',
    context: bm({ uid: 'b23', surface: 'community', pct: 8, done: 2, enrollment: lateJoin(21) }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'community', 'women', 'welcome']],
      avoid: GUILT,
    },
  },

  // ── Performance-aware tone ─────────────────────────────────────
  {
    id: 'bm-tone-at-risk-home',
    note: 'Inactive 6 days — warm, one small step, no guilt',
    context: bm({
      uid: 'b24',
      pct: 20,
      done: 6,
      nextTask: T.theme,
      dues: [],
      performance: perf('at-risk', { tasksDone: 6, tasksOpen: 12, batchMedianDone: 11 }),
    }),
    expect: { job: 'nudge', taskId: T.theme.id, mention: [['Theme Management']], avoid: GUILT },
  },
  {
    id: 'bm-tone-slipping-home',
    note: 'Behind batch median — encourage, one concrete step',
    context: bm({
      uid: 'b25',
      pct: 33,
      done: 10,
      nextTask: T.postCapability,
      dues: [due(T.postCapability)],
      performance: perf('slipping', { tasksDone: 10, tasksOpen: 14, batchMedianDone: 13 }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.postCapability.id,
      mention: [['Capability Matrix']],
      avoid: GUILT,
    },
  },
  {
    id: 'bm-tone-on-track-home',
    note: 'On track — affirm + next step',
    context: bm({
      uid: 'b26',
      pct: 50,
      done: 14,
      nextTask: T.politics,
      dues: [],
      performance: perf('on-track', { tasksDone: 14, tasksOpen: 15, batchMedianDone: 14 }),
    }),
    expect: { job: 'nudge', taskId: T.politics.id, mention: [['Politics Management']] },
  },
  {
    id: 'bm-tone-star-home',
    note: 'Ahead of batch — affirm + stretch',
    context: bm({
      uid: 'b27',
      pct: 75,
      done: 21,
      nextTask: T.linkedinShow,
      dues: [],
      performance: perf('star', { tasksDone: 21, tasksOpen: 21, batchMedianDone: 15 }),
    }),
    expect: {
      job: 'nudge',
      taskId: T.linkedinShow.id,
      mention: [
        ['LinkedIn Brand Video'],
        ['ahead', 'stretch', 'challenge', 'next level', 'consistent'],
      ],
    },
  },
  {
    id: 'bm-tone-at-risk-learn',
    note: 'Learn tab, inactive learner — one gentle lesson',
    context: bm({
      uid: 'b28',
      surface: 'learn',
      pct: 18,
      done: 5,
      nextTask: T.diffBrand,
      performance: perf('at-risk'),
    }),
    expect: {
      job: 'recommend',
      taskId: T.diffBrand.id,
      mention: [['Differentiated Brand']],
      avoid: GUILT,
    },
  },
  {
    id: 'bm-tone-star-learn',
    note: 'Learn tab, star — stretch lesson',
    context: bm({
      uid: 'b29',
      surface: 'learn',
      pct: 70,
      done: 20,
      nextTask: T.ceo,
      performance: perf('star', { tasksDone: 20, tasksOpen: 20, batchMedianDone: 15 }),
    }),
    expect: { job: 'recommend', taskId: T.ceo.id, mention: [['Speak Like a CEO']] },
  },
  {
    id: 'bm-tone-slipping-community',
    note: 'Engage tab, slipping — lean on the cohort',
    context: bm({
      uid: 'b30',
      surface: 'community',
      pct: 30,
      done: 9,
      performance: perf('slipping'),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'community', 'women', 'share']],
      avoid: GUILT,
    },
  },
  {
    id: 'bm-tone-on-track-community',
    note: 'Engage tab, on track — share a win',
    context: bm({
      uid: 'b31',
      surface: 'community',
      pct: 52,
      done: 15,
      performance: perf('on-track'),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'share', 'post', 'community', 'win']],
    },
  },

  // ── Edge cases ─────────────────────────────────────────────────
  {
    id: 'bm-edge-zero-progress',
    note: 'Week one, 0% — must not say "0%"',
    context: bm({ uid: 'b32', pct: 0, done: 0, nextTask: T.coreStory, dues: [] }),
    expect: { job: 'nudge', taskId: T.coreStory.id, mention: [['Core Story']], avoid: ['0%'] },
  },
  {
    id: 'bm-edge-title-surname',
    note: 'Title + surname — first name only',
    context: bm({
      uid: 'b33',
      name: 'Mrs. Lakshmi Venkatesan',
      pct: 40,
      done: 12,
      nextTask: T.pitching,
      dues: [],
    }),
    expect: {
      job: 'nudge',
      taskId: T.pitching.id,
      mention: [['Lakshmi'], ['Pitching']],
      avoid: ['Mrs.', 'Venkatesan'],
    },
  },
  {
    id: 'bm-edge-no-next',
    note: 'Paid, no next task, no session info — no invented session or date',
    context: bm({ uid: 'b34', pct: 100, done: 28, dues: [] }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['done', 'complete', 'caught up', 'clear', 'graduat']],
    },
  },
  {
    id: 'bm-edge-walk-to-board',
    note: 'Walk to Board week — the high-stakes moment',
    context: bm({
      uid: 'b35',
      pct: 90,
      done: 25,
      nextTask: T.walkToBoard,
      dues: [due(T.wtbPrep, { urgent: true })],
    }),
    expect: {
      job: 'nudge',
      taskId: T.wtbPrep.id,
      mention: [['WTB', 'Walk to Board', 'Pitch Video']],
    },
  },
  {
    id: 'bm-edge-learn-no-next',
    note: 'Learn tab, everything cleared',
    context: bm({ uid: 'b36', surface: 'learn', pct: 100, done: 28 }),
    expect: {
      job: 'recommend',
      taskId: null,
      mention: [['cleared', 'complete', 'done', 'caught up']],
    },
  },
];

module.exports.TASKS = T;
module.exports.PAID_ONLY = PAID_ONLY;
