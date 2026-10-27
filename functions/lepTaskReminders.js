/**
 * LEP task reminders, driven by the CMS templates TASK-OPEN / TASK-DUE / TASK-OVERDUE
 * (anchor taskOpen / taskDue, their time and day offset) and lepTaskSchedule.json
 * (generated in app-new by scripts/build_lep_task_schedule.py from the task list and
 * LEP-Messages-Complete-v6.xlsx).
 *
 *   open    — a phase's tasks open (Day 1 + phaseOpenDay, or CX's date on the Unlock calendar)
 *   due     — the morning a task is due: the day of its due session (S1, S3 …) in this batch
 *   overdue — the day after, while she has not handed it in
 *
 * One message per learner per phase / day — six Day 1 tasks are one nudge, not six.
 * Pure — no Firestore. Mirrored for the CMS Messages screen in app-new/utils/batchMessagePlan.js.
 */

const SCHEDULE = require('./lepTaskSchedule.json');

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE = new Set(['submitted', 'under_review', 'completed']);
/** Part-paid learners can open only these phases (app utils/phaseUnlock.js). */
const REGISTER_PHASES = new Set(['pre-program', 'orientation']);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDay(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function istMs(day, hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Date.parse(`${day}T${m[1].padStart(2, '0')}:${m[2]}:00+05:30`) : null;
}

function shortDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** "A, B and 2 more" */
function listTitles(tasks, max = 2) {
  const names = tasks.map((t) => t.title);
  if (names.length <= max) return names.join(' and ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/** Day a phase opens for this batch: CX's date, else Day 1 + offset. null = held back or no date. */
function phaseOpenDay(batch, phaseId) {
  const override = batch?.phaseOverrides?.[phaseId];
  if (override === 'locked') return null;
  if (isoDay(override)) return isoDay(override);
  if (override === 'open') return null; // opened by hand on an unknown day — no "opens" nudge
  const day1 = isoDay(batch?.day1Date);
  const offset = SCHEDULE.phaseOpenDay[phaseId];
  return day1 && Number.isFinite(offset) ? addDays(day1, offset) : null;
}

/** Day a task is due in this batch: the date of its due session, unless that phase is held back. */
function taskDueDay(batch, task) {
  if (!task.dueSession || batch?.phaseOverrides?.[task.phase] === 'locked') return null;
  const session = (batch?.sessions || []).find((s) => s.code === task.dueSession && !s.cancelled);
  return isoDay(session?.date);
}

/** Which kind a CMS template is, or null when it is not a task reminder this module sends. */
function taskReminderKind(event) {
  const a = event?.anchor || {};
  if (a.ref && a.ref !== '*') return null; // one specific task (T12…) — not mapped yet
  // Mandatory-only overdue: its T02/T03/T12/T20 list is not mapped to app tasks yet, and
  // sending it for every task would repeat TASK-OVERDUE the same morning.
  if (event.code === 'MAND-OVERDUE' || event.priority === 'mandatory') return null;
  if (a.type === 'taskOpen') return 'open';
  if (a.type === 'taskDue') return (Number(a.dayOffset) || 0) >= 1 ? 'overdue' : 'due';
  return null;
}

/**
 * Fires inside [windowStartMs, windowEndMs] for one batch and template.
 * @returns {Array<{ kind, key, day, tasks, fireAtMs, dedupeKey }>}
 */
function taskReminderFires(batch, event, windowStartMs, windowEndMs) {
  const kind = taskReminderKind(event);
  if (!kind) return [];
  const a = event.anchor || {};
  const shift = Number(a.dayOffset) || 0;
  const groups = new Map();
  for (const task of SCHEDULE.tasks) {
    const base = kind === 'open' ? phaseOpenDay(batch, task.phase) : taskDueDay(batch, task);
    if (!base) continue;
    const day = addDays(base, shift);
    // Phases opening the same day share one nudge; due / overdue group by due day.
    const key = kind === 'open' ? 'open' : base;
    const id = `${key}|${day}`;
    if (!groups.has(id)) groups.set(id, { key, day, dueDay: base, tasks: [] });
    groups.get(id).tasks.push(task);
  }
  const out = [];
  for (const g of groups.values()) {
    const fireAtMs = istMs(g.day, a.time);
    if (fireAtMs == null || fireAtMs < windowStartMs || fireAtMs > windowEndMs) continue;
    out.push({ kind, ...g, fireAtMs, dedupeKey: `${batch.id}|${event.code}|${kind}|${g.key}|${g.day}` });
  }
  return out;
}

/**
 * The message one learner gets for a fire, or null when nothing applies to her.
 * doneIds: task ids she has handed in (submitted / under review / completed).
 */
function messageForLearner(fire, event, { paymentStatus, doneIds = new Set(), name = 'there' }) {
  let tasks = fire.tasks;
  if (paymentStatus === 'register') tasks = tasks.filter((t) => REGISTER_PHASES.has(t.phase));
  if (fire.kind !== 'open') tasks = tasks.filter((t) => !doneIds.has(t.id));
  if (!tasks.length) return null;

  const [first] = tasks;
  const more = tasks.length - 1;
  const go = tasks.length === 1 ? { to: 'task', programId: 'lep', taskId: first.id } : { to: 'myProgram' };
  const phaseTitle = SCHEDULE.phaseTitle[first.phase] || 'New tasks';

  if (fire.kind === 'open') {
    const onePhase = tasks.every((t) => t.phase === first.phase);
    return {
      title: !more ? `New: ${first.title}` : onePhase ? `${phaseTitle} is open · ${tasks.length} tasks` : `New tasks are open · ${tasks.length}`,
      body: first.opens,
      go,
    };
  }
  if (fire.kind === 'due') {
    return {
      title: more ? `Due today · ${tasks.length} tasks` : 'Due today',
      body: more ? `${first.due} Also due: ${listTitles(tasks.slice(1))}.` : first.due,
      go,
    };
  }
  // overdue — the CMS template text, filled
  const vars = { name, pendingTasks: listTitles(tasks), dueTime: shortDay(fire.dueDay), task: first.title };
  const fill = (s) => String(s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  return {
    title: fill(event.title || event.name || 'Still pending'),
    body: fill(event.body || 'Still pending: {{pendingTasks}} (was due {{dueTime}}).'),
    go,
  };
}

function doneTaskIds(submissions) {
  return new Set(submissions.filter((s) => DONE.has(s.status)).map((s) => s.taskId));
}

module.exports = {
  SCHEDULE,
  taskReminderKind,
  taskReminderFires,
  messageForLearner,
  doneTaskIds,
  phaseOpenDay,
  taskDueDay,
};
