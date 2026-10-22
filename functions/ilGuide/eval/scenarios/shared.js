/**
 * Shared building blocks for IL Guide test learners — one shape for every program.
 *
 * CONTEXT a scenario sends (what the app + nightly profile will provide):
 *   participantId, surface ('home' | 'learn' | 'community'), firstLogin, name?
 *   programs[], primaryProgram { id, code, title, paymentStatus, progress }
 *   progressPercent, journeyProgress
 *   nextTask?          { id, title, type }            next open journey task
 *   dues?              [{ taskId, title, done, urgent?, mandatory? }]  this week's items
 *   lepDues?           same as dues (LEP only — the field today's app sends)
 *   lepPractice?       LEP daily practice / rituals state
 *   lepBatch? / batch? { nextSessionTitle, nextSessionWhen }
 *   upcomingEvent?     { id, title, body }
 *   enrollment?        { status, joinedLate, joinedDaysAfterStart, sessionsBeforeJoin[] }
 *   performance?       { segment, daysInactive, practiceDays7, tasksDone, tasksOpen,
 *                        batchMedianDone, missedSessions[] }
 *
 * PAYMENT (constants/programs.js in app-new):
 *   register  part payment — only phases marked openRegistered are open
 *   paid      full payment — everything open as the calendar allows
 *
 * NEXT-STEP PRIORITY (proposed — Program Lead to confirm):
 *   1. First login → welcome + first open task.
 *   2. Live session within 24h → that session.
 *   3. Urgent / mandatory due → that due.
 *   4. LEP practice left today (rituals open) → today's practice.
 *   5. Any open due → that due.
 *   6. Next journey task.
 *   7. All clear → celebrate, point at the next session.
 *   Part-paid with every open task done → the next step is continuing her journey
 *   ("enroll to unlock Day 2 and the rest of your journey"). Never a payment
 *   reminder: no amount, no "balance", no "payment", no urgency.
 *   Late joiner → every message nudges her to catch up ("catch up" / "get up to
 *   speed"), with the oldest mandatory catch-up item as the one step and recordings
 *   for sessions held before she joined. Warm, no guilt, never the whole backlog.
 *   A session in the next 24h still leads; the catch-up nudge follows it.
 *
 * TONE BY SEGMENT:
 *   at-risk  (5+ days inactive)  warm, one small step, no guilt words
 *   slipping (behind batch)      encourage, one concrete step
 *   on-track                     affirm, next step
 *   star     (ahead of batch)    affirm + stretch
 *
 * VOICE (checked on every message — see checks.js):
 *   Never hurts: no blame, shame or comparing her with others.
 *   Never sales or transactional: no pay / balance / offer / hurry / limited.
 *   Professional: no emojis, slang or pet names, at most one "!", no shouting.
 *   Goal-focused: when she has set a goal (context.goal), tie the step to it.
 */

const PAY = { REGISTER: 'register', PAID: 'paid' };

const PROGRAMS = {
  LEP: { id: 'lep', code: 'LEP', title: 'Leadership Essentials Program' },
  BM: { id: '100bm', code: '100BM', title: '100 Board Members' },
  MBW: { id: 'mbw', code: 'MBW', title: 'Master of Business Warfare' },
};

/** Words an at-risk, late or slipping learner must never see. */
const GUILT = [
  'overdue',
  'behind',
  'still pending',
  'you missed',
  'failed',
  'disappoint',
  'lagging',
  'absent',
];

/** Program name alternatives a message may use. */
const PROGRAM_NAMES = {
  lep: ['LEP', 'Leadership Essentials'],
  '100bm': ['100BM', '100 Board Members'],
  mbw: ['MBW', 'Business Warfare'],
};

function prog(p, paymentStatus, percent, done, total) {
  return { ...p, paymentStatus, progress: { percent, done, total } };
}

/**
 * Build one learner context. Unset fields are left out, exactly as the app strips them.
 * `dues` is copied to `lepDues` for LEP so today's engine sees what the app sends.
 */
function ctx({
  uid,
  surface = 'home',
  name = 'Priya Sharma',
  program = PROGRAMS.LEP,
  pay = PAY.PAID,
  pct = 0,
  done = 0,
  total = 20,
  dues,
  ...rest
}) {
  const primary = prog(program, pay, pct, done, total);
  const out = {
    participantId: uid,
    surface,
    firstLogin: false,
    ...(name ? { name } : {}),
    programs: [primary],
    primaryProgram: primary,
    batchId: `grp_${program.id}_demo`,
    progressPercent: pct,
    journeyProgress: { percent: pct, done, total },
    ...(dues ? { dues } : {}),
    ...(dues && program.id === 'lep' ? { lepDues: dues } : {}),
    ...rest,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

const practice = (
  doneToday,
  totalToday,
  streak = 0,
  ritualsUnlocked = true,
  ritualsDoneToday = false
) => ({
  practiceDoneToday: doneToday,
  practiceTotalToday: totalToday,
  currentStreak: streak,
  ritualsUnlocked,
  ritualsDoneToday,
});

const perf = (segment, extra = {}) => ({
  segment,
  daysInactive: segment === 'at-risk' ? 6 : segment === 'slipping' ? 2 : 0,
  practiceDays7: { 'at-risk': 0, slipping: 3, 'on-track': 5, star: 7 }[segment] ?? 3,
  tasksDone: 6,
  tasksOpen: 10,
  batchMedianDone: 8,
  ...extra,
});

const lateJoin = (joinedDaysAfterStart, sessionsBeforeJoin = []) => ({
  status: 'joined',
  joinedLate: true,
  joinedDaysAfterStart,
  sessionsBeforeJoin,
});

/** How a part-paid learner's next step is worded: her journey, not a transaction. */
const CONTINUE_JOURNEY = [
  'enroll',
  'enrol',
  'enrolment',
  'enrollment',
  'rest of your journey',
  'full program',
  'unlock',
];

/**
 * Goals learners set (LEP B-HAG, 100BM board aspiration, MBW business goal). `keywords`
 * are the words a goal-focused message would carry.
 */
const GOALS = {
  lep: [
    { text: 'Become CHRO of a listed company by 2028', keywords: ['CHRO'] },
    { text: 'Lead a 200-person engineering org', keywords: ['engineering org', 'lead', '200'] },
    {
      text: 'Get promoted to Vice President this year',
      keywords: ['Vice President', 'VP', 'promot'],
    },
  ],
  '100bm': [
    { text: 'Secure an independent board seat', keywords: ['board seat', 'board'] },
    { text: 'Join the board of a listed company', keywords: ['board'] },
  ],
  mbw: [
    { text: 'Scale my business to 10 crore revenue', keywords: ['scale', 'business', 'revenue'] },
    { text: 'Open a second clinic in Bengaluru', keywords: ['second clinic', 'clinic'] },
  ],
};

/**
 * Give every other eligible learner a goal, so the test set has learners with and
 * without one. Sessions-within-24h stay goal-free: the session leads those.
 */
function withGoals(scenarios) {
  let n = 0;
  return scenarios.map((s) => {
    const pid = s.context?.primaryProgram?.id;
    const pool = GOALS[pid];
    if (!pool || s.context.goal || s.expect.job === 'event' || s.context.surface === 'community')
      return s;
    n += 1;
    if (n % 2) return s;
    const goal = pool[n % pool.length];
    return {
      ...s,
      context: { ...s.context, goal: { text: goal.text } },
      expect: { ...s.expect, mention: [...(s.expect.mention || []), goal.keywords] },
    };
  });
}

/** Words that count as a catch-up nudge. */
const CATCH_UP = ['catch up', 'catch-up', 'catching up', 'up to speed'];

/**
 * Central late-joiner rule, applied to every program's scenarios so it cannot drift:
 * a late joiner must always be nudged to catch up, and never with guilt words.
 */
function withLateJoinRules(scenarios) {
  return scenarios.map((s) => {
    if (!s.context?.enrollment?.joinedLate) return s;
    const mention = [...(s.expect.mention || []), CATCH_UP];
    const avoid = [...new Set([...(s.expect.avoid || []), ...GUILT])];
    return { ...s, expect: { ...s.expect, mention, avoid } };
  });
}

module.exports = {
  PAY,
  PROGRAMS,
  PROGRAM_NAMES,
  GUILT,
  CATCH_UP,
  CONTINUE_JOURNEY,
  GOALS,
  ctx,
  practice,
  perf,
  lateJoin,
  withLateJoinRules,
  withGoals,
};
