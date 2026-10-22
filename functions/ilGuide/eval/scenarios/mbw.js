/**
 * MBW golden scenarios — Master of Business Warfare, a 52-week cohort.
 *
 * Phases (app-new constants/programCourseSlice.js): Pre-Preparation is open on a
 * part payment; Quarter 1–4 and Graduation open only on full payment. MBW has no
 * LEP-style daily practice, so no lepPractice here. Session topics are never
 * invented — every expectation names only titles present in the context.
 */
const {
  CONTINUE_JOURNEY,
  ctx,
  perf,
  lateJoin,
  PAY,
  PROGRAMS,
  PROGRAM_NAMES,
  GUILT,
} = require('./shared');

const P = PROGRAMS.MBW;
const NAMES = PROGRAM_NAMES.mbw;

const T = {
  orientation: {
    id: 'mbw-orientation',
    title: 'Orientation Session by Rajesh (Live session recording)',
    type: 'video',
  },
  principles: { id: 'mbw-principles', title: '27 Principles Video', type: 'video' },
  csuite: { id: 'mbw-csuite', title: 'C-Suite Talk - Topic Finalization', type: 'form' },
  errc: { id: 'mbw-errc', title: 'ERRC — Watch Video', type: 'video' },
  objectives: { id: 'mbw-objectives', title: 'Objectives', type: 'form' },
  resume: { id: 'mbw-resume', title: 'Resume Preparation Video', type: 'video' },
  mirror: { id: 'mbw-mirror', title: 'Mirror Practice', type: 'video' },
  commitment: { id: 'mbw-commitment', title: 'Your commitment for the session', type: 'form' },
  powerfulRequest: { id: 'mbw-powerful-request', title: 'Powerful Request Video', type: 'video' },
  q1Resume: { id: 'q1-csuite-resume', title: 'C-Suite Resume', type: 'file' },
  q1Story: { id: 'q1-csuite-story', title: 'C-Suite Story', type: 'form' },
  q1VideoCv: { id: 'q1-video-cv', title: 'Video CV', type: 'video' },
  q1Report: { id: 'q1-progress-report', title: 'Q1 Progress Report', type: 'form' },
  q2Differentiation: { id: 'q2-differentiation', title: 'Differentiation Statement', type: 'form' },
  q2Pitch: { id: 'q2-pitch-video', title: 'Pitch Video (1.5 mins)', type: 'video' },
  q2Strategy: { id: 'q2-strategy-draft', title: 'Strategy — First Draft', type: 'form' },
  q3Mock: { id: 'q3-interview-mock', title: 'C-Suite Interview Mock Video', type: 'video' },
  q3GamePlan: { id: 'q3-game-plan', title: 'Game Plan', type: 'form' },
  q4Errc: { id: 'q4-final-errc', title: 'Final ERRC Revision', type: 'form' },
  q4Apply: { id: 'q4-apply-csuite', title: 'Apply for C-Suite Position', type: 'form' },
  gradPrep: { id: 'grad-prep-3', title: 'Graduation Preparation — Week 3', type: 'form' },
  gradCeremony: { id: 'grad-ceremony', title: 'Graduation Ceremony', type: 'read' },
};

/** Everything outside Pre-Preparation — a part-paid (register) learner cannot open these. */
const PAID_ONLY = [
  T.q1Resume,
  T.q1Story,
  T.q1VideoCv,
  T.q1Report,
  T.q2Differentiation,
  T.q2Pitch,
  T.q2Strategy,
  T.q3Mock,
  T.q3GamePlan,
  T.q4Errc,
  T.q4Apply,
  T.gradPrep,
  T.gradCeremony,
].map((t) => t.id);

const due = (t, extra = {}) => ({ taskId: t.id, title: t.title, done: false, ...extra });
const doneDue = (t) => ({ taskId: t.id, title: t.title, done: true });
const session = (title, when) => ({ nextSessionTitle: title, nextSessionWhen: when });
const event = (id, title, body) => ({ id, title, body });

const base = (o) => ctx({ program: P, name: 'Kavya Iyer', total: 85, ...o });
const ENROLL = CONTINUE_JOURNEY;
const AMOUNT_AVOID = ['₹', 'rs.', 'inr', 'rupees'];

module.exports = [
  // ── First login ────────────────────────────────────────────────
  {
    id: 'mbw-onboard-register',
    note: 'First login, MBW part-paid — Pre-Preparation opens with Orientation',
    context: base({
      uid: 'w1',
      firstLogin: true,
      pay: PAY.REGISTER,
      location: 'Bengaluru',
      domain: 'Finance',
      nextTask: T.orientation,
      total: 15,
    }),
    expect: {
      job: 'onboard',
      taskId: T.orientation.id,
      mention: [['Kavya'], NAMES, ['Orientation']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'mbw-onboard-paid',
    note: 'First login, MBW fully paid',
    context: base({ uid: 'w2', firstLogin: true, pay: PAY.PAID, nextTask: T.orientation }),
    expect: {
      job: 'onboard',
      taskId: T.orientation.id,
      mention: [['Kavya'], NAMES, ['Orientation']],
    },
  },
  {
    id: 'mbw-onboard-no-name',
    note: 'First login, no name on profile',
    context: base({ uid: 'w3', firstLogin: true, name: null, nextTask: T.orientation }),
    expect: {
      job: 'onboard',
      taskId: T.orientation.id,
      mention: [NAMES, ['Orientation']],
      avoid: ['undefined', 'null'],
    },
  },

  // ── Part-paid vs full across the phases ────────────────────────
  {
    id: 'mbw-register-prep-next',
    note: 'Part-paid, mid Pre-Preparation — next open prep task',
    context: base({ uid: 'w4', pay: PAY.REGISTER, pct: 40, done: 6, total: 15, nextTask: T.errc }),
    expect: { job: 'nudge', taskId: T.errc.id, mention: [['ERRC']], lockedTaskIds: PAID_ONLY },
  },
  {
    id: 'mbw-register-prep-due',
    note: 'Part-paid, a prep item due this week beats the journey order',
    context: base({
      uid: 'w5',
      pay: PAY.REGISTER,
      pct: 30,
      done: 4,
      total: 15,
      nextTask: T.principles,
      dues: [due(T.objectives)],
    }),
    expect: {
      job: 'nudge',
      taskId: T.objectives.id,
      mention: [['Objectives']],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'mbw-register-prep-all-done',
    note: 'Part-paid, all Pre-Preparation done — next step is completing enrollment, no amount',
    context: base({ uid: 'w6', pay: PAY.REGISTER, pct: 100, done: 15, total: 15, dues: [] }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [ENROLL],
      avoid: AMOUNT_AVOID,
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'mbw-paid-q1',
    note: 'Fully paid, Quarter 1 — next journey task',
    context: base({ uid: 'w7', pct: 22, done: 19, nextTask: T.q1Story, dues: [] }),
    expect: { job: 'nudge', taskId: T.q1Story.id, mention: [['C-Suite Story']] },
  },
  {
    id: 'mbw-paid-q2',
    note: 'Fully paid, Quarter 2 — pitch video is due',
    context: base({
      uid: 'w8',
      pct: 41,
      done: 35,
      nextTask: T.q2Differentiation,
      dues: [due(T.q2Pitch)],
    }),
    expect: { job: 'nudge', taskId: T.q2Pitch.id, mention: [['Pitch Video']] },
  },
  {
    id: 'mbw-paid-q3',
    note: 'Fully paid, Quarter 3 — next journey task',
    context: base({ uid: 'w9', pct: 63, done: 54, nextTask: T.q3GamePlan, dues: [] }),
    expect: { job: 'nudge', taskId: T.q3GamePlan.id, mention: [['Game Plan']] },
  },
  {
    id: 'mbw-paid-q4',
    note: 'Fully paid, Quarter 4 — apply for a C-Suite role',
    context: base({ uid: 'w10', pct: 82, done: 70, nextTask: T.q4Apply, dues: [] }),
    expect: { job: 'nudge', taskId: T.q4Apply.id, mention: [['C-Suite Position', 'C-Suite']] },
  },
  {
    id: 'mbw-paid-graduation',
    note: 'Fully paid, graduation weeks',
    context: base({
      uid: 'w11',
      pct: 95,
      done: 81,
      nextTask: T.gradPrep,
      dues: [],
      batch: session('Graduation Ceremony', 'Sat 27 Jun, 11:00 AM'),
    }),
    expect: { job: 'nudge', taskId: T.gradPrep.id, mention: [['Graduation']] },
  },

  // ── Next-step priority ─────────────────────────────────────────
  {
    id: 'mbw-session-tomorrow',
    note: 'Live session within 24h — the session is the next step',
    context: base({
      uid: 'w12',
      pct: 30,
      done: 25,
      nextTask: T.q1VideoCv,
      upcomingEvent: event(
        'mbw-s3',
        'Impact Champion: Video CV & C-Suite Application',
        'Sat 18 Oct · 10:00 AM'
      ),
      batch: session('Impact Champion: Video CV & C-Suite Application', 'Sat 18 Oct, 10:00 AM'),
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['Impact Champion'], ['Sat 18 Oct', '10:00 AM', 'tomorrow']],
    },
  },
  {
    id: 'mbw-urgent-due',
    note: 'Urgent mandatory due beats the next journey task',
    context: base({
      uid: 'w13',
      pct: 33,
      done: 28,
      nextTask: T.q1Story,
      dues: [due(T.q1Report, { urgent: true, mandatory: true })],
    }),
    expect: {
      job: 'nudge',
      taskId: T.q1Report.id,
      mention: [['Q1 Progress Report', 'Progress Report']],
    },
  },
  {
    id: 'mbw-due-already-done',
    note: 'Journey next task already done in dues — must not be suggested',
    context: base({
      uid: 'w14',
      pct: 44,
      done: 37,
      nextTask: T.q2Pitch,
      dues: [doneDue(T.q2Pitch), due(T.q2Strategy)],
    }),
    expect: {
      job: 'nudge',
      taskId: T.q2Strategy.id,
      mention: [['Strategy']],
      avoid: ['Pitch Video'],
    },
  },
  {
    id: 'mbw-all-clear',
    note: 'Everything done this week — celebrate, point at the next session',
    context: base({
      uid: 'w15',
      pct: 50,
      done: 43,
      dues: [],
      batch: session('Impact Champions: Networking', 'Sat 8 Nov, 10:00 AM'),
    }),
    expect: { job: 'nudge', taskId: null, mention: [['Networking']] },
  },

  // ── Late joiners ───────────────────────────────────────────────
  {
    id: 'mbw-late-first-login',
    note: 'Joins 3 weeks after cohort start — oldest mandatory item first, no guilt',
    context: base({
      uid: 'w16',
      firstLogin: true,
      pct: 5,
      done: 4,
      nextTask: T.q1Resume,
      dues: [
        due(T.orientation, { mandatory: true }),
        due(T.objectives, { mandatory: true }),
        due(T.q1Resume),
      ],
      enrollment: lateJoin(21, ['Orientation Session by Rajesh (Live session recording)']),
    }),
    expect: {
      job: 'onboard',
      taskId: T.orientation.id,
      mention: [['Kavya'], ['Orientation']],
      avoid: [...GUILT, 'Objectives'],
    },
  },
  {
    id: 'mbw-late-home',
    note: 'Late joiner a week in — catch up the oldest mandatory item, one step only',
    context: base({
      uid: 'w17',
      pct: 12,
      done: 10,
      nextTask: T.q1Story,
      dues: [due(T.commitment, { mandatory: true }), due(T.q1Resume, { mandatory: true })],
      enrollment: lateJoin(28, ['Preparation Session by Suvarna (Live session recording)']),
    }),
    expect: {
      job: 'nudge',
      taskId: T.commitment.id,
      mention: [['commitment']],
      avoid: [...GUILT, 'C-Suite Resume'],
    },
  },
  {
    id: 'mbw-late-register',
    note: 'Late joiner on part payment — catch up only open prep items',
    context: base({
      uid: 'w18',
      pay: PAY.REGISTER,
      firstLogin: true,
      pct: 0,
      done: 0,
      total: 15,
      nextTask: T.orientation,
      dues: [due(T.orientation, { mandatory: true }), due(T.principles, { mandatory: true })],
      enrollment: lateJoin(14, ['Orientation Session by Rajesh (Live session recording)']),
    }),
    expect: {
      job: 'onboard',
      taskId: T.orientation.id,
      mention: [['Orientation']],
      avoid: GUILT,
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'mbw-late-session-tomorrow',
    note: 'Late joiner with backlog, but a live session is within 24h — session wins',
    context: base({
      uid: 'w19',
      pct: 8,
      done: 7,
      nextTask: T.q1Resume,
      dues: [due(T.objectives, { mandatory: true })],
      upcomingEvent: event(
        'mbw-s1',
        'Impact Champions: LinkedIn Profile & Post',
        'Sat 11 Oct · 10:00 AM'
      ),
      batch: session('Impact Champions: LinkedIn Profile & Post', 'Sat 11 Oct, 10:00 AM'),
      enrollment: lateJoin(18),
    }),
    expect: {
      job: 'event',
      taskId: null,
      mention: [['LinkedIn Profile', 'Impact Champions']],
      avoid: GUILT,
    },
  },
  {
    id: 'mbw-late-learn',
    note: 'Late joiner on Learn — recommend the recording of a session held before she joined',
    context: base({
      uid: 'w20',
      surface: 'learn',
      pct: 6,
      done: 5,
      nextTask: T.orientation,
      enrollment: lateJoin(20, ['Orientation Session by Rajesh (Live session recording)']),
    }),
    expect: {
      job: 'recommend',
      taskId: T.orientation.id,
      mention: [['Orientation']],
      avoid: GUILT,
    },
  },
  {
    id: 'mbw-late-community',
    note: 'Late joiner on Engage — welcome into the cohort',
    context: base({ uid: 'w21', surface: 'community', pct: 6, done: 5, enrollment: lateJoin(20) }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'circle', 'community', 'welcome']],
      avoid: GUILT,
    },
  },

  // ── Performance segments ───────────────────────────────────────
  {
    id: 'mbw-home-at-risk',
    note: 'Inactive 6 days — warm, one small step, no guilt',
    context: base({
      uid: 'w22',
      pct: 20,
      done: 17,
      nextTask: T.q1Resume,
      dues: [],
      performance: perf('at-risk'),
    }),
    expect: {
      job: 'nudge',
      taskId: T.q1Resume.id,
      mention: [['C-Suite Resume', 'Resume']],
      avoid: GUILT,
    },
  },
  {
    id: 'mbw-home-slipping',
    note: 'Behind batch — encourage, one concrete step',
    context: base({
      uid: 'w23',
      pct: 25,
      done: 21,
      nextTask: T.q1VideoCv,
      dues: [due(T.q1VideoCv)],
      performance: perf('slipping'),
    }),
    expect: { job: 'nudge', taskId: T.q1VideoCv.id, mention: [['Video CV']], avoid: GUILT },
  },
  {
    id: 'mbw-home-on-track',
    note: 'On track — affirm, next step',
    context: base({
      uid: 'w24',
      pct: 45,
      done: 38,
      nextTask: T.q2Strategy,
      dues: [],
      performance: perf('on-track'),
    }),
    expect: { job: 'nudge', taskId: T.q2Strategy.id, mention: [['Strategy']] },
  },
  {
    id: 'mbw-home-star',
    note: 'Ahead of batch — affirm + stretch',
    context: base({
      uid: 'w25',
      pct: 70,
      done: 60,
      nextTask: T.q3Mock,
      dues: [],
      performance: perf('star', { tasksDone: 60, tasksOpen: 61, batchMedianDone: 48 }),
    }),
    expect: { job: 'nudge', taskId: T.q3Mock.id, mention: [['Mock']] },
  },
  {
    id: 'mbw-learn-at-risk',
    note: 'Learn tab, inactive learner — one gentle recommendation',
    context: base({
      uid: 'w26',
      surface: 'learn',
      pct: 15,
      done: 13,
      nextTask: T.resume,
      performance: perf('at-risk'),
    }),
    expect: { job: 'recommend', taskId: T.resume.id, mention: [['Resume']], avoid: GUILT },
  },
  {
    id: 'mbw-learn-star',
    note: 'Learn tab, ahead of batch',
    context: base({
      uid: 'w27',
      surface: 'learn',
      pct: 66,
      done: 56,
      nextTask: T.q3GamePlan,
      performance: perf('star'),
    }),
    expect: { job: 'recommend', taskId: T.q3GamePlan.id, mention: [['Game Plan']] },
  },
  {
    id: 'mbw-learn-q2',
    note: 'Learn tab, on track in Quarter 2',
    context: base({
      uid: 'w28',
      surface: 'learn',
      pct: 40,
      done: 34,
      nextTask: T.q2Differentiation,
      performance: perf('on-track'),
    }),
    expect: { job: 'recommend', taskId: T.q2Differentiation.id, mention: [['Differentiation']] },
  },
  {
    id: 'mbw-community-at-risk',
    note: 'Engage tab, inactive — gentle reconnect with the cohort',
    context: base({
      uid: 'w29',
      surface: 'community',
      pct: 18,
      done: 15,
      performance: perf('at-risk', { daysInactive: 9 }),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'circle', 'community', 'women']],
      avoid: GUILT,
    },
  },
  {
    id: 'mbw-community-slipping',
    note: 'Engage tab, behind batch — the cohort can help',
    context: base({
      uid: 'w30',
      surface: 'community',
      pct: 28,
      done: 24,
      performance: perf('slipping'),
    }),
    expect: {
      job: 'nudge',
      taskId: null,
      mention: [['cohort', 'batch', 'circle', 'community', 'share', 'post']],
      avoid: GUILT,
    },
  },
  {
    id: 'mbw-community-star',
    note: 'Engage tab, ahead — share a win',
    context: base({
      uid: 'w31',
      surface: 'community',
      pct: 72,
      done: 61,
      performance: perf('star'),
    }),
    expect: { job: 'nudge', taskId: null, mention: [['share', 'post', 'win', 'cohort', 'circle']] },
  },

  // ── Edge cases ─────────────────────────────────────────────────
  {
    id: 'mbw-edge-title-surname',
    note: 'Title and surname on profile — first name only',
    context: base({
      uid: 'w32',
      name: 'Dr. Lakshmi R. Menon',
      pct: 30,
      done: 26,
      nextTask: T.q1Story,
    }),
    expect: {
      job: 'nudge',
      taskId: T.q1Story.id,
      mention: [['Lakshmi'], ['C-Suite Story']],
      avoid: ['Dr.,', 'Menon'],
    },
  },
  {
    id: 'mbw-edge-zero-progress',
    note: 'Day one at 0% — must not say "0%"',
    context: base({
      uid: 'w33',
      pay: PAY.REGISTER,
      pct: 0,
      done: 0,
      total: 15,
      nextTask: T.orientation,
    }),
    expect: {
      job: 'nudge',
      taskId: T.orientation.id,
      mention: [['Orientation']],
      avoid: ['0%'],
      lockedTaskIds: PAID_ONLY,
    },
  },
  {
    id: 'mbw-edge-no-next',
    note: 'Fully paid, no next task, no session — no invented session or date',
    context: base({ uid: 'w34', pct: 100, done: 85, dues: [] }),
    expect: { job: 'nudge', taskId: null, mention: [['done', 'complete', 'caught up', 'clear']] },
  },
  {
    id: 'mbw-edge-no-name-learn',
    note: 'Learn tab, no name — no placeholder',
    context: base({
      uid: 'w35',
      surface: 'learn',
      name: null,
      pct: 10,
      done: 9,
      nextTask: T.powerfulRequest,
    }),
    expect: {
      job: 'recommend',
      taskId: T.powerfulRequest.id,
      mention: [['Powerful Request']],
      avoid: ['undefined', 'null'],
    },
  },
];

module.exports.TASKS = T;
module.exports.PAID_ONLY = PAID_ONLY;
