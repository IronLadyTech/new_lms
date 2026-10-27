import { describe, it, expect } from 'vitest';
import {
  SCHEDULE,
  taskReminderFires,
  messageForLearner,
  doneTaskIds,
  phaseOpenDay,
  taskDueDay,
  taskReminderKind,
} from './lepTaskReminders.js';

/**
 * Task reminders. What goes wrong for a learner: a "due" nudge for work she has
 * handed in, six pushes when six tasks open, a part-paid learner told about locked
 * phases, or a due date that ignores a rescheduled session.
 */

// Day 1 Sat 31 Oct 2026. Sessions on their template days.
const SESS = { S0: -2, S1: 0, S2: 1, S3: 3, S4: 7, S6: 11, S5: 14, S7: 21, S8: 28 };
const day = (n) => new Date(Date.parse('2026-10-31T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const BATCH = { id: 'b1', day1Date: '2026-10-31', sessions: Object.entries(SESS).map(([code, n]) => ({ code, date: day(n) })) };
const OPEN = { code: 'TASK-OPEN', anchor: { type: 'taskOpen', ref: '*', time: '10:00' } };
const DUE = { code: 'TASK-DUE', anchor: { type: 'taskDue', ref: '*', time: '10:00' }, condition: 'incomplete' };
const OVERDUE = {
  code: 'TASK-OVERDUE',
  anchor: { type: 'taskDue', ref: '*', dayOffset: 1, time: '10:00' },
  title: 'Task overdue',
  body: 'Still pending: {{pendingTasks}} (was due {{dueTime}}).',
};
const ALL = [0, Date.parse('2030-01-01')];
const fireOn = (event, d) => taskReminderFires(BATCH, event, ...ALL).filter((f) => f.day === d);

describe('the schedule', () => {
  it('has all 54 LEP tasks with their sheet copy', () => {
    expect(SCHEDULE.tasks).toHaveLength(54);
    for (const t of SCHEDULE.tasks) expect(t.opens && t.due && t.after).toBeTruthy();
  });

  it('due dates follow the batch’s own session dates', () => {
    const via = SCHEDULE.tasks.find((t) => t.id === 'lep-via-survey');
    expect(taskDueDay(BATCH, via)).toBe(day(0)); // before Day 1
    const moved = { ...BATCH, sessions: BATCH.sessions.map((s) => (s.code === 'S1' ? { ...s, date: day(7) } : s)) };
    expect(taskDueDay(moved, via)).toBe(day(7)); // Day 1 moved a week → due moves too
  });

  it('respects the CX Unlock calendar: held back = silent, own date = that date', () => {
    expect(phaseOpenDay({ ...BATCH, phaseOverrides: { 'week-1': 'locked' } }, 'week-1')).toBeNull();
    expect(phaseOpenDay({ ...BATCH, phaseOverrides: { 'week-1': '2026-11-05' } }, 'week-1')).toBe('2026-11-05');
    expect(phaseOpenDay(BATCH, 'week-1')).toBe(day(2));
  });

  it('only the generic templates send — one-task refs and mandatory-only wait', () => {
    expect(taskReminderKind(OPEN)).toBe('open');
    expect(taskReminderKind(DUE)).toBe('due');
    expect(taskReminderKind(OVERDUE)).toBe('overdue');
    expect(taskReminderKind({ ...OVERDUE, code: 'MAND-OVERDUE', priority: 'mandatory' })).toBeNull();
    expect(taskReminderKind({ ...DUE, anchor: { ...DUE.anchor, ref: 'T20' } })).toBeNull();
  });
});

describe('what she receives', () => {
  it('one nudge when a phase opens, not one per task', () => {
    const [fire] = fireOn(OPEN, day(0)); // Day 1 phase opens on Day 1
    expect(fire.tasks.length).toBeGreaterThan(1);
    const msg = messageForLearner(fire, OPEN, { paymentStatus: 'paid' });
    expect(msg.title).toMatch(/Day 1 .* is open · \d+ tasks/);
    expect(msg.go).toEqual({ to: 'myProgram' });
  });

  it('due today: only the tasks she has not handed in', () => {
    const [fire] = fireOn(DUE, day(0)); // pre-program + orientation tasks due Day 1
    const all = messageForLearner(fire, DUE, { paymentStatus: 'paid' });
    expect(all.title).toBe(`Due today · ${fire.tasks.length} tasks`);
    const doneIds = new Set(fire.tasks.slice(1).map((t) => t.id));
    const one = messageForLearner(fire, DUE, { paymentStatus: 'paid', doneIds });
    expect(one.title).toBe('Due today');
    expect(one.body).toBe(fire.tasks[0].due);
    expect(one.go).toEqual({ to: 'task', programId: 'lep', taskId: fire.tasks[0].id });
    const none = messageForLearner(fire, DUE, { paymentStatus: 'paid', doneIds: new Set(fire.tasks.map((t) => t.id)) });
    expect(none).toBeNull();
  });

  it('overdue the next morning, naming what is still pending', () => {
    const [fire] = fireOn(OVERDUE, day(1));
    const msg = messageForLearner(fire, OVERDUE, { paymentStatus: 'paid' });
    expect(msg.body).toMatch(/^Still pending: .+ \(was due Sat 31 Oct\)\.$/);
  });

  it('part-paid learners hear only about pre-program and orientation tasks', () => {
    const [d1open] = fireOn(OPEN, day(0)); // Day 1 phase — locked for part-paid
    expect(messageForLearner(d1open, OPEN, { paymentStatus: 'register' })).toBeNull();
    const [prework] = fireOn(DUE, day(0));
    expect(messageForLearner(prework, DUE, { paymentStatus: 'register' })).not.toBeNull();
  });

  it('a needs-improvement task still counts as not done', () => {
    const ids = doneTaskIds([
      { taskId: 'a', status: 'submitted' },
      { taskId: 'b', status: 'needs_improvement' },
      { taskId: 'c', status: 'completed' },
    ]);
    expect([...ids].sort()).toEqual(['a', 'c']);
  });

  it('dedupe key per batch, template, group and day', () => {
    const [fire] = fireOn(DUE, day(0));
    expect(fire.dedupeKey).toBe(`b1|TASK-DUE|due|${day(0)}|${day(0)}`);
  });
});
