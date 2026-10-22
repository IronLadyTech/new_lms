/**
 * Assembles the Stitch home dashboard payload from existing LMS services.
 * Shape matches `STITCH_HOME_MOCK` so presentational components stay unchanged.
 */
import { PROGRAMS } from '../data/programTypes';
import { PAYMENT_STATUS, programPaymentStatus } from '../data/accessTiers';
import { getRoleLabel } from '../utils/roles';
import { getProgramLessonPath } from '../utils/programTaskRoutes';
import { getProgramMarketingUrl } from '../utils/courseDisplay';
import {
  PROGRAM_JOURNEY,
  PROGRAM_ACCESS,
  canAccessProgram,
  getContinueProgram,
  getEnrolledProgramEntries,
  getEnrolledProgramIds,
  getProgramAccessState,
  canOpenProgramTasks,
  courseCodeToProgramId,
} from '../utils/programAccess';
import {
  computeSectionProgress as computeMbwSectionProgress,
  getTotalMilestones as getMbwTotal,
  getCompletedMilestones as getMbwCompleted,
  countPendingTasks,
} from '../utils/mbwProgramUtils';
import {
  computeSectionProgress as computeBm100SectionProgress,
  getTotalMilestones as getBm100Total,
  getCompletedMilestones as getBm100Completed,
} from '../utils/bm100ProgramUtils';
import {
  computeSectionProgress as computeLepSectionProgress,
  getTotalMilestones as getLepTotal,
  getCompletedMilestones as getLepCompleted,
} from '../utils/lepProgramUtils';
import { formatExpiresIn } from './announcementService';
import { LEP_PROGRAM_SECTIONS } from '../data/lepProgramStructure';
import { BM100_PROGRAM_SECTIONS } from '../data/bm100ProgramStructure';
import { MBW_PROGRAM_SECTIONS } from '../data/mbwProgramStructure';
import { TASK_TYPES } from './mbwService';
import { asFullyPaid } from '../utils/phaseLock';

const PROGRAM_META = {
  [PROGRAMS.LEP]: {
    image: '/programs/lep.png',
    meta: [
      { icon: 'clock', label: '4 weeks' },
      { icon: 'layers', label: '2 live days + weekly sessions' },
    ],
  },
  [PROGRAMS.BM100]: {
    image: '/programs/100bm.png',
    meta: [
      { icon: 'clock', label: '6 months' },
      { icon: 'layers', label: 'Online cohort' },
    ],
  },
  [PROGRAMS.MBW]: {
    image: '/programs/mbw.png',
    meta: [
      { icon: 'clock', label: '1 year' },
      { icon: 'layers', label: 'Quarterly weekends + online' },
    ],
  },
};

const NAV = {
  primary: [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid', href: '/app/home-next' },
    { id: 'browse', label: 'Browse Courses', icon: 'book-open', href: '/app/browse' },
    { id: 'my-courses', label: 'My Courses', icon: 'folder', href: '/app/home#courses' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', href: '/app/schedule' },
    { id: 'progress', label: 'Track Progress', icon: 'chart-column', href: '/app/progress' },
  ],
  footer: [
    { id: 'settings', label: 'Settings', icon: 'settings', href: '/app/profile' },
    { id: 'support', label: 'Help & Support', icon: 'headset', href: '/app/support' },
    { id: 'logout', label: 'Log Out', icon: 'log-out', danger: true, action: 'logout' },
  ],
  activeId: 'dashboard',
};

function firstNameFrom(displayName) {
  return (
    String(displayName ?? '')
      .trim()
      .split(/\s+/)[0] || ''
  );
}

function initialFrom(displayName) {
  const first = firstNameFrom(displayName);
  return (first.charAt(0) || 'I').toUpperCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatRelativeWhen(createdAt) {
  const ms = toMillis(createdAt);
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (sameDay) return `Today · ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  const days = Math.floor((now - date) / (24 * 60 * 60 * 1000));
  if (days < 7) return `${days} days ago · ${time}`;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${time}`;
}

function formatEventDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix} ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}

function activityKind(type = '') {
  const t = String(type).toLowerCase();
  if (t.includes('complete') || t.includes('finish')) return 'done';
  if (t.includes('submit') || t.includes('assignment') || t.includes('upload')) return 'submit';
  if (t.includes('live') || t.includes('join') || t.includes('session') || t.includes('attend')) {
    return 'live';
  }
  return 'submit';
}

function activityVerb(type = '') {
  const t = String(type).toLowerCase();
  if (t.includes('complete')) return 'completed';
  if (t.includes('enroll')) return 'enrolled in';
  if (t.includes('join') || t.includes('live')) return 'joined';
  if (t.includes('view')) return 'viewed';
  return 'submitted';
}

function programDotFromEvent(ev, profileProgram) {
  const raw = String(ev?.program || ev?.programId || profileProgram || '').toLowerCase();
  if (raw === 'lep' || raw.includes('lep')) return 'lep';
  if (raw === '100bm' || raw === 'bm100' || raw.includes('100')) return 'bm100';
  if (raw === 'mbw' || raw.includes('mbw') || raw.includes('warfare')) return 'mbw';
  return 'mbw';
}

function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function buildHoursSpent(dailyCounts = []) {
  return {
    dailyCounts: (dailyCounts || []).map((row) => ({
      date: row.date,
      count: row.count || 0,
    })),
    /* Defaults kept for first paint; UI recalculates from dailyCounts + period. */
    periodLabel: 'This week',
    totalLabel: '0 days',
    trendLabel: 'No activity yet',
    trendDirection: 'flat',
    bars: [0, 0, 0, 0, 0, 0, 0],
    dayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  };
}

function progressForProgram(programId, engines, profile) {
  if (programId === PROGRAMS.MBW) {
    const sp = computeMbwSectionProgress(engines.mbw?.taskStates || [], profile);
    return {
      total: getMbwTotal(sp),
      completed: getMbwCompleted(sp),
      pending: countPendingTasks(engines.mbw?.taskStates),
    };
  }
  if (programId === PROGRAMS.BM100) {
    const sp = computeBm100SectionProgress(engines.bm100?.taskStates || [], profile);
    return {
      total: getBm100Total(sp),
      completed: getBm100Completed(sp),
      pending: countPendingTasks(engines.bm100?.taskStates),
    };
  }
  if (programId === PROGRAMS.LEP) {
    const sp = computeLepSectionProgress(engines.lep?.taskStates || [], profile);
    return {
      total: getLepTotal(sp),
      completed: getLepCompleted(sp),
      pending: countPendingTasks(engines.lep?.taskStates),
    };
  }
  return { total: 0, completed: 0, pending: 0 };
}

function buildContinueLearning(profile, courses, engines) {
  const continueCourse = getContinueProgram(profile, courses);
  const accessible = PROGRAM_JOURNEY.filter((p) => canAccessProgram(p.id, profile, courses));
  const target =
    continueCourse ||
    (accessible[0]
      ? { code: accessible[0].code, title: accessible[0].title, id: accessible[0].id }
      : null);

  if (!target) {
    return {
      eyebrow: 'Continue learning',
      title: 'Explore your Iron Lady journey',
      nextLabel: 'LEP → 100BM → MBW. Speak to our Counsellor to enrol.',
      progressPct: 0,
      progressLabel: '0 of 0 milestones',
      ctaLabel: 'Explore programs',
      href: '/app/home#courses',
    };
  }

  const programId = courseCodeToProgramId(target.code) || target.id;
  const entry = PROGRAM_JOURNEY.find((p) => p.id === programId);
  const { total, completed, pending } = progressForProgram(programId, engines, profile);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return {
    eyebrow: 'Continue learning',
    title: entry?.title || target.title || 'Your programme',
    nextLabel: pending
      ? `${pending} task${pending === 1 ? '' : 's'} waiting`
      : total
        ? 'You are caught up — keep the streak going'
        : 'Open your programme to start the next task',
    progressPct: pct,
    progressLabel: total ? `${completed} of ${total} milestones` : 'Progress unlocks with tasks',
    ctaLabel: entry ? 'Open tasks' : 'Continue',
    href: entry?.tasksPath || '/app/home',
  };
}

function buildStatistics(profile, courses, engines, streakSummary) {
  const enrolled = getEnrolledProgramEntries(profile, courses);
  let inProgress = 0;
  let completed = 0;

  enrolled.forEach((entry) => {
    const { total, completed: done } = progressForProgram(entry.id, engines, profile);
    if (total > 0 && done >= total) completed += 1;
    else inProgress += 1;
  });

  const weekActive = (streakSummary?.dailyCounts || []).filter((row) => {
    const d = new Date(`${row.date}T12:00:00`);
    const monday = startOfWeekMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return d >= monday && d <= sunday && (row.count || 0) > 0;
  }).length;

  return [
    {
      id: 'in-progress',
      value: inProgress,
      unit: inProgress === 1 ? 'programme' : 'programmes',
      label: 'In progress',
      icon: 'pie-chart',
      tone: 'blue',
    },
    {
      id: 'completed',
      value: completed,
      unit: completed === 1 ? 'programme' : 'programmes',
      label: 'Completed',
      icon: 'circle-check',
      tone: 'green',
    },
    {
      id: 'week',
      value: weekActive,
      unit: weekActive === 1 ? 'day' : 'days',
      label: 'Active this week',
      icon: 'stopwatch',
      tone: 'rose',
    },
    {
      id: 'pending',
      value:
        countPendingTasks(engines.mbw?.taskStates) +
        countPendingTasks(engines.bm100?.taskStates) +
        countPendingTasks(engines.lep?.taskStates),
      unit: 'tasks',
      label: 'Pending tasks',
      icon: 'award-ribbon',
      tone: 'amber',
    },
  ];
}

function buildAchievements(profile, courses, engines, streakSummary, learnerName) {
  const badges = [];
  const enrolled = getEnrolledProgramEntries(profile, courses);
  const anyComplete = enrolled.some((entry) => {
    const { total, completed } = progressForProgram(entry.id, engines, profile);
    return total > 0 && completed >= total;
  });
  const current = streakSummary?.currentStreak || 0;
  const totalCorrect = streakSummary?.totalCorrect?.count || 0;

  if (totalCorrect > 0) {
    badges.push({ id: 'first', title: 'First submission', tone: 'gold', icon: 'trophy' });
  }
  if (current >= 7) {
    badges.push({ id: 'streak', title: 'Week streak', tone: 'red', icon: 'flame' });
  }
  if (anyComplete) {
    badges.push({ id: 'complete', title: 'Programme complete', tone: 'charcoal', icon: 'medal' });
  }
  while (badges.length < 4) {
    badges.push({
      id: `locked-${badges.length}`,
      title: 'Locked',
      tone: 'muted',
      icon: 'lock',
    });
  }

  const continueMeta = buildContinueLearning(profile, courses, engines);

  return {
    badges: badges.slice(0, 4),
    leaderboard: {
      rank: current > 0 ? `${current}d` : '—',
      name: learnerName || 'You',
      meta: continueMeta.progressLabel,
    },
  };
}

function buildProgressTracks(profile, courses, engines) {
  return getEnrolledProgramEntries(profile, courses).map((entry) => {
    const { total, completed } = progressForProgram(entry.id, engines, profile);
    const segs = Math.min(Math.max(total || 6, 1), 8);
    const filled = total ? Math.round((completed / total) * segs) : 0;
    return {
      id: entry.id,
      title: entry.title,
      label: total ? `${completed} of ${total}` : 'No tasks yet',
      filled,
      total: segs,
    };
  });
}

/** Section progress per programme, so a lock can be asked about by programme id. */
const SECTION_PROGRESS = {
  [PROGRAMS.MBW]: { engine: 'mbw', compute: computeMbwSectionProgress },
  [PROGRAMS.BM100]: { engine: 'bm100', compute: computeBm100SectionProgress },
  [PROGRAMS.LEP]: { engine: 'lep', compute: computeLepSectionProgress },
};

/**
 * Whether payment — and not phase progression — is what is holding this learner
 * up right now.
 *
 * Payment decides eligibility; finishing a phase decides progression. Somebody
 * still working through Phase 1 is not blocked by payment, even though later
 * phases carry a paid gate, so a "complete payment" prompt is premature: the
 * phase lock on the section itself already says what is needed, at the point
 * they reach it.
 *
 * `resolveGate` returns one boolean for both reasons, so the only way to tell
 * them apart is to ask twice — once as the learner is, once as if the programme
 * were paid. Only the learner's *next* phase is asked about, though: LEP also
 * carries side sections gated on payment alone with no sequence in front of
 * them ("community", "weekly-progress"), and those flip from the first day,
 * which would put the prompt back on every registration-tier learner.
 */
function paymentIsBlocking(programId, engines, profile) {
  const spec = SECTION_PROGRESS[programId];
  if (!spec) return false;

  const taskStates = engines?.[spec.engine]?.taskStates || [];
  /* Nothing loaded yet. Staying quiet beats guessing at a payment prompt. */
  if (!taskStates.length) return false;

  const actual = spec.compute(taskStates, profile);
  /* Section order is programme order, so the first locked one is what they are
     working towards next. */
  const next = Object.keys(actual).find((id) => !actual[id]?.unlocked);
  if (!next) return false;

  return spec.compute(taskStates, asFullyPaid(profile, programId))[next]?.unlocked === true;
}

/**
 * Asks for payment only where payment is the thing standing in the way.
 *
 * This used to fire on registration tier alone, which put a permanent prompt on
 * the dashboard of 379 of 500 learners — registration tier is the normal state
 * on entry, not a delinquency, and most of those learners were weeks away from
 * the first paid gate.
 */
function buildPaymentBanner(profile, courses, engines) {
  const enrolled = getEnrolledProgramEntries(profile, courses);
  for (const entry of enrolled) {
    if (programPaymentStatus(profile, entry.id) === PAYMENT_STATUS.PAID) continue;

    /* Nothing in the programme is open: payment gates the whole of it. */
    if (!canOpenProgramTasks(entry.id, profile, courses)) {
      return {
        show: true,
        title: `${entry.shortLabel} is locked`,
        subtitle: 'Complete the required payment to access the content.',
        ctaLabel: 'Complete payment',
        href: '/app/support',
      };
    }

    if (paymentIsBlocking(entry.id, engines, profile)) {
      return {
        show: true,
        title: `${entry.shortLabel}: the next phase needs full payment`,
        subtitle: 'You have finished what the registration amount covers.',
        ctaLabel: 'Complete payment',
        href: '/app/support',
      };
    }
  }
  return { show: false, title: '', subtitle: '', ctaLabel: '', href: '/app/support' };
}

function buildCalendarAndEvents(visibleEvents, profile) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const events = [...(visibleEvents || [])]
    .filter((e) => e?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((ev) => ({
      id: ev.id,
      title: ev.title || 'Session',
      date: ev.date,
      dateLabel: formatEventDateLabel(ev.date),
      program: programDotFromEvent(ev, profile?.program),
      /*
       * These are stored on every event and were being dropped here, which is
       * why the rail could only ever show a title and a date — it had nothing
       * else to show. `linkUrl` in particular is what a join button needs.
       */
      time: ev.time || '',
      endTime: ev.endTime || '',
      type: ev.type || 'general',
      linkUrl: ev.linkUrl || '',
      /* Carried for the Google Calendar link, which puts it in the invite body
         along with the joining link. */
      description: ev.description || '',
      /* One deep link per event, the same one the calendar page understands. */
      href: `/app/calendar?date=${encodeURIComponent(ev.date)}&event=${encodeURIComponent(ev.id)}`,
    }));

  return {
    calendar: {
      year,
      month,
      monthLabel: now.toLocaleString('en-US', { month: 'long' }),
      /* Local date, not ISO — an ISO string is UTC and would mark the wrong day
         for anyone east of Greenwich after early evening. */
      todayIso: now.toLocaleDateString('en-CA'),
    },
    events,
  };
}

function resolveActivityProgram(activity, courses = []) {
  const metaProgram = String(activity?.metadata?.program || activity?.program || '').toLowerCase();
  if (metaProgram === 'lep' || metaProgram.includes('lep')) return 'lep';
  if (metaProgram === '100bm' || metaProgram === 'bm100' || metaProgram.includes('100'))
    return 'bm100';
  if (metaProgram === 'mbw' || metaProgram.includes('mbw') || metaProgram.includes('warfare')) {
    return 'mbw';
  }

  const courseId = activity?.courseId;
  if (courseId) {
    const course = (courses || []).find((c) => c.id === courseId);
    const fromCode = courseCodeToProgramId(course?.code);
    if (fromCode) return fromCode;
  }

  const title = String(activity?.title || '').toLowerCase();
  if (title.includes('lep') || title.includes('leadership essentials')) return 'lep';
  if (title.includes('100bm') || title.includes('100 board') || title.includes('board member')) {
    return 'bm100';
  }
  if (title.includes('mbw') || title.includes('business warfare')) return 'mbw';
  return 'all';
}

function buildActivity(activities = [], courses = []) {
  return (activities || []).slice(0, 40).map((a) => ({
    id: a.id,
    kind: activityKind(a.type),
    actor: 'You',
    verb: activityVerb(a.type),
    target: a.title || a.type || 'activity',
    when: formatRelativeWhen(a.createdAt),
    createdAtMs: toMillis(a.createdAt),
    program: resolveActivityProgram(a, courses),
  }));
}

/** Engine key per programme, so its task state can be read. */
const ENGINE_KEY = {
  [PROGRAMS.MBW]: 'mbw',
  [PROGRAMS.BM100]: 'bm100',
  [PROGRAMS.LEP]: 'lep',
};

/**
 * "Your programmes" means the learner's own — enrolled or registered, nothing
 * else. Programmes they have not joined are catalogue, and catalogue belongs on
 * Browse Courses; listing them here padded a personal section with two cards
 * the learner could only be turned away from.
 *
 * Ordering is the journey order among what is left. There is no upcoming or
 * locked state to sort around any more, because neither can appear here.
 */
function ownedProgrammes(profile, courses) {
  const enrolled = getEnrolledProgramIds(profile, courses);
  return PROGRAM_JOURNEY.filter((entry) => enrolled.has(entry.id));
}

function buildProgrammes(profile, courses, engines, includeAll = false) {
  /* Browse Courses shows the whole catalogue; "Your programmes" shows only
     what the learner owns. Same builder, so both describe a programme the
     same way. */
  const list = includeAll ? PROGRAM_JOURNEY : ownedProgrammes(profile, courses);
  return list.map((entry) => {
    const access = getProgramAccessState(entry.id, profile, courses);
    const locked = access.state !== PROGRAM_ACCESS.OPEN;
    const metaPack = PROGRAM_META[entry.id];
    /* The CTA comes from the access state rather than being re-derived here.
       Upcoming and locked both read "Speak to our Counsellor" — inventing
       "Upcoming" / "Locked" buttons gave the learner nothing to press. */
    const ctaLabel = access.cta;

    /* The blurb is the course's own description rather than a second copy
       written here — one that drifted would be worse than none. */
    const course = (courses || []).find((c) => courseCodeToProgramId(c?.code) === entry.id);

    const { total, completed, pending } = progressForProgram(entry.id, engines, profile);
    const pct = total ? Math.round((completed / total) * 100) : 0;

    /*
     * Open tasks lands on the task the learner actually stopped at, not the
     * top of the programme. `nextTaskState` is the first task that is neither
     * complete nor locked. With no engine loaded — a locked programme never
     * builds one — it falls back to the programme page rather than guessing an
     * id that may not exist.
     */
    const engine = engines?.[ENGINE_KEY[entry.id]];
    const resumeTaskId = engine?.nextTaskState?.task?.id || null;
    const openHref =
      !locked && resumeTaskId ? getProgramLessonPath(entry.code, resumeTaskId) : entry.tasksPath;

    /* One rule, shared with the dashboard card — see canOpenProgramTasks. */
    const canOpenTasks = !locked && canOpenProgramTasks(entry.id, profile, courses);
    const marketingUrl = getProgramMarketingUrl(entry.code);

    return {
      id: entry.id,
      title: entry.title,
      image: metaPack.image,
      meta: metaPack.meta,
      description: course?.description || '',
      progressPct: pct,
      progressLabel: total ? `${completed} of ${total} milestones` : '',
      pending,
      ctaLabel,
      locked,
      /* Carried through so the panel reads one answer instead of re-deriving
         its own from CTA strings. */
      state: access.state,
      statusLabel: access.label,
      statusMessage: access.message,
      canOpenTasks,
      marketingUrl,
      href: canOpenTasks ? openHref : marketingUrl || '/app/support',
    };
  });
}

/* Programme identity for Track Progress. The colours match the Browse posters
   so a programme is the same colour wherever the learner meets it. */
const PROGRESS_META = {
  [PROGRAMS.LEP]: { color: '#F5B301', sections: LEP_PROGRAM_SECTIONS },
  [PROGRAMS.BM100]: { color: '#231F20', sections: BM100_PROGRAM_SECTIONS },
  [PROGRAMS.MBW]: { color: '#C8102E', sections: MBW_PROGRAM_SECTIONS },
};

/* What the learner is being asked to do, in words rather than a type code. */
const TASK_KIND_LABEL = {
  [TASK_TYPES.WATCH_ONLY]: 'Session recording',
  [TASK_TYPES.TEXT]: 'Written task',
  [TASK_TYPES.EDITABLE_TEMPLATE]: 'Template',
  [TASK_TYPES.FILE_UPLOAD]: 'Upload',
  [TASK_TYPES.LINK]: 'Link submission',
  [TASK_TYPES.VIDEO_RECORD]: 'Video assignment',
  [TASK_TYPES.RECURRING_POST]: 'Recurring post',
  [TASK_TYPES.CHECKLIST]: 'Checklist',
};

/**
 * Programmes and their modules, for Track Progress.
 *
 * A "module" is a programme section — the same sections the programme page
 * gates and the same progress numbers, so the two pages cannot disagree.
 * Only the section the learner is actually on carries the next task; the
 * others have nothing specific to offer yet.
 */
function buildProgressProgrammes(profile, courses, engines) {
  return getEnrolledProgramEntries(profile, courses).map((entry) => {
    const spec = SECTION_PROGRESS[entry.id];
    const meta = PROGRESS_META[entry.id];
    const taskStates = engines?.[spec?.engine]?.taskStates || [];
    const progress = spec && taskStates.length ? spec.compute(taskStates, profile) : {};

    /* The first section that is open and unfinished is the one she is on. */
    const currentId = meta.sections.find((sec) => {
      const p = progress[sec.id];
      return p?.unlocked && p.done < p.total;
    })?.id;

    const nextTask = engines?.[spec?.engine]?.nextTaskState?.task || null;

    const modules = meta.sections.map((sec, i) => {
      const p = progress[sec.id] || { done: 0, total: 0, unlocked: false };
      const complete = p.total > 0 && p.done >= p.total;
      const isCurrent = sec.id === currentId;

      let state = 'idle';
      if (complete) state = 'done';
      else if (!p.unlocked) state = 'locked';
      else if (isCurrent) state = 'live';

      return {
        id: sec.id,
        n: i + 1,
        title: sec.title,
        state,
        done: p.done,
        total: p.total,
        /* Real counts only — there is no forecast of a finish date anywhere in
           the app, so none is shown. */
        pct: p.total ? Math.round((p.done / p.total) * 100) : 0,
        why: state === 'locked' ? sec.lockedMessage || '' : '',
        next:
          isCurrent && nextTask
            ? {
                title: nextTask.title,
                kind: TASK_KIND_LABEL[nextTask.type] || 'Task',
                cta: p.done > 0 ? 'Resume' : 'Get started',
                href: getProgramLessonPath(entry.code, nextTask.id),
              }
            : null,
      };
    });

    return {
      id: entry.id,
      code: entry.shortLabel,
      name: entry.title,
      color: meta.color,
      total: modules.length,
      modules,
      tasksPath: entry.tasksPath,
    };
  });
}

/**
 * The activity calendar and the four-week figures.
 *
 * Everything here is a count of real submissions. "Time on task" and "live
 * sessions attended" are not recorded anywhere, so they are not shown — three
 * figures that are true beat five where two are invented.
 */
function buildProgressActivity(streakSummary) {
  const counts = streakSummary?.dailyCounts || [];
  const byDate = {};
  counts.forEach(({ date, count }) => {
    byDate[date] = count;
  });

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 27);
  const key = (d) => d.toLocaleDateString('en-CA');
  const from = key(cutoff);
  const to = key(now);

  const recent = counts.filter((c) => c.date >= from && c.date <= to);
  const tasks = recent.reduce((sum, c) => sum + (c.count || 0), 0);
  const activeDays = recent.filter((c) => (c.count || 0) > 0).length;

  return {
    byDate,
    todayIso: to,
    fourWeeks: [
      { value: String(tasks), label: 'Tasks completed' },
      { value: String(activeDays), label: 'Active days' },
      { value: String(streakSummary?.currentStreak || 0), label: 'Day streak' },
    ],
    /* Already generated from this learner's own history — not a message
       written here to fill the space. */
    note: streakSummary?.insights?.[0] || '',
  };
}

/**
 * Just the chrome — the nav model and the learner summary the shell needs.
 *
 * Settings and Help & Support want the same sidebar and topbar as every other
 * page, but none of the dashboard behind it. Without this they would either
 * load courses, events, three task engines and the streak history to render a
 * name in the corner, or carry their own copy of the learner shape.
 */
export function buildStitchChrome({ user, profile, role }) {
  const displayName = profile?.displayName || user?.displayName || user?.email || 'Learner';
  return {
    nav: NAV,
    learner: {
      id: user?.uid || 'learner',
      displayName,
      firstName: firstNameFrom(displayName),
      roleLabel: `${getRoleLabel(role)}, Learner`,
      initial: initialFrom(displayName),
      /* Empty until she uploads one; the initial stands in. */
      photoURL: profile?.photoURL || '',
    },
  };
}

function buildPracticeStreak(streakSummary) {
  const today = new Date();
  const year = today.getFullYear();
  const years = [year, year - 1, year - 2];
  const current = streakSummary?.currentStreak || 0;
  const longest = streakSummary?.longestStreak?.days || 0;
  const totalCorrect = streakSummary?.totalCorrect?.count || 0;
  const daysSince = streakSummary?.daysSinceLastActivity;
  const todayStatus =
    daysSince === 0
      ? 'Practiced today'
      : current > 0
        ? 'No practice yet today'
        : 'Start a streak today';

  const dailyCounts = streakSummary?.dailyCounts || [];

  return {
    current,
    longest,
    totalCorrect,
    years,
    activeYear: year,
    todayStatus,
    helpHref: '/app/progress',
    dailyCounts,
  };
}

function buildAnnouncements(list = []) {
  return (list || []).slice(0, 5).map((a) => {
    const expires = formatExpiresIn(a) || '';
    return {
      id: a.id,
      title: a.title || 'Announcement',
      subtitle:
        [a.body || a.message || '', expires].filter(Boolean).join(' · ') || 'Iron Lady update',
    };
  });
}

/**
 * @param {object} input
 * @param {object} input.user
 * @param {object} input.profile
 * @param {string} input.role
 * @param {object[]} input.courses
 * @param {object[]} input.announcements
 * @param {object[]} input.activities
 * @param {object[]} input.visibleEvents
 * @param {{ mbw?: object, bm100?: object, lep?: object }} input.engines
 * @param {object|null} input.streakSummary
 */
export function buildStitchHomeDashboard({
  user,
  profile,
  role,
  courses = [],
  announcements = [],
  activities = [],
  visibleEvents = [],
  engines = {},
  streakSummary = null,
}) {
  const displayName = profile?.displayName || user?.displayName || user?.email || 'Learner';
  const { calendar, events } = buildCalendarAndEvents(visibleEvents, profile);

  return {
    ...buildStitchChrome({ user, profile, role }),
    continueLearning: buildContinueLearning(profile, courses, engines),
    statistics: buildStatistics(profile, courses, engines, streakSummary),
    achievements: buildAchievements(profile, courses, engines, streakSummary, displayName),
    hoursSpent: buildHoursSpent(streakSummary?.dailyCounts),
    progressTracks: buildProgressTracks(profile, courses, engines),
    announcements: buildAnnouncements(announcements),
    paymentBanner: buildPaymentBanner(profile, courses, engines),
    calendar,
    events,
    activity: buildActivity(activities, courses),
    programmes: buildProgrammes(profile, courses, engines),
    /* Every programme, enrolled or not — the Browse Courses catalogue. */
    catalogue: buildProgrammes(profile, courses, engines, true),
    practiceStreak: buildPracticeStreak(streakSummary),
    progress: {
      programmes: buildProgressProgrammes(profile, courses, engines),
      activity: buildProgressActivity(streakSummary),
    },
  };
}
