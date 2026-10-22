import { describe, it, expect } from 'vitest';
import { buildStitchHomeDashboard } from './stitchHomeDashboardService';
import { getStaticTasks } from './lepService';
import { SUBMISSION_STATUS } from './mbwService';
import { PROGRAMS } from '../data/programTypes';
import { PAYMENT_STATUS } from '../data/accessTiers';

/**
 * What Track Progress is allowed to say.
 *
 * The design this page came from carried a projected finish date, a "time on
 * task" total, "live sessions attended" and a certificates shelf. None of those
 * is recorded anywhere in the LMS. Invented figures are the one defect a
 * screenshot cannot catch — they look exactly like real ones — so the rule is
 * pinned here instead.
 */

const COURSES = [{ id: 'c-lep', code: 'LEP', title: 'Leadership Essentials Program' }];
const LEP_TASKS = getStaticTasks();

function lepStates(donePhases) {
  const done = new Set(donePhases);
  return LEP_TASKS.map((task) => ({
    task,
    status: done.has(task.phase) ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.UNLOCKED,
    isComplete: done.has(task.phase),
  }));
}

function build(donePhases, paymentStatus = PAYMENT_STATUS.PAID, streakSummary = undefined) {
  return buildStitchHomeDashboard({
    user: { uid: 'u1', displayName: 'Test Learner' },
    profile: {
      programs: [PROGRAMS.LEP],
      programAccess: { [PROGRAMS.LEP]: { paymentStatus } },
    },
    role: 'student',
    courses: COURSES,
    engines: { lep: { taskStates: lepStates(donePhases), nextTaskState: null } },
    streakSummary,
  }).progress;
}

const lep = (progress) => progress.programmes.find((p) => p.id === PROGRAMS.LEP);
const mod = (progress, id) => lep(progress).modules.find((m) => m.id === id);

describe('modules describe the programme as it really stands', () => {
  it('marks a finished section done and the one being worked on live', () => {
    const p = build(['orientation']);
    expect(mod(p, 'orientation').state).toBe('done');
    expect(mod(p, 'pre-program').state).toBe('live');
  });

  it('gives only one module the live state — the one she is on', () => {
    const live = lep(build(['orientation', 'pre-program'])).modules.filter(
      (m) => m.state === 'live'
    );
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe('day-1');
  });

  it('counts real tasks rather than a percentage of nothing', () => {
    const m = mod(build(['orientation']), 'orientation');
    expect(m.total).toBeGreaterThan(0);
    expect(m.done).toBe(m.total);
    expect(m.pct).toBe(100);
  });

  it('says why a locked module is locked, in the programme’s own words', () => {
    const m = mod(build(['orientation']), 'day-2');
    expect(m.state).toBe('locked');
    expect(m.why).toMatch(/complete day 1/i);
  });

  it('never invents a finish date', () => {
    for (const m of lep(build(['orientation'])).modules) {
      expect(m).not.toHaveProperty('eta');
    }
  });
});

describe('the four-week figures are counted, not written', () => {
  const summary = {
    dailyCounts: [
      { date: '2020-01-01', count: 9 }, // outside the window
    ],
    currentStreak: 0,
    insights: [],
  };

  it('shows only figures the LMS actually records', () => {
    const labels = build(['orientation'], PAYMENT_STATUS.PAID, summary).activity.fourWeeks.map(
      (f) => f.label
    );
    expect(labels).toEqual(['Tasks completed', 'Active days', 'Day streak']);
    // Neither is tracked anywhere; both were in the design.
    expect(labels).not.toContain('Time on task');
    expect(labels.some((l) => /live session/i.test(l))).toBe(false);
  });

  it('leaves old activity out of the last four weeks', () => {
    const four = build(['orientation'], PAYMENT_STATUS.PAID, summary).activity.fourWeeks;
    expect(four[0].value).toBe('0');
    expect(four[1].value).toBe('0');
  });

  it('keeps every day for the calendar, even outside the four-week window', () => {
    const { byDate } = build(['orientation'], PAYMENT_STATUS.PAID, summary).activity;
    expect(byDate['2020-01-01']).toBe(9);
  });

  it('shows no note rather than a made-up one when there is nothing to say', () => {
    expect(build(['orientation'], PAYMENT_STATUS.PAID, summary).activity.note).toBe('');
  });

  it('repeats an insight the streak service generated, never its own', () => {
    const withNote = { ...summary, insights: ['3-day streak active — submit today to extend it.'] };
    expect(build(['orientation'], PAYMENT_STATUS.PAID, withNote).activity.note).toBe(
      '3-day streak active — submit today to extend it.'
    );
  });

  it('has no certificates to show, so offers none', () => {
    expect(build(['orientation'])).not.toHaveProperty('certificates');
  });
});
