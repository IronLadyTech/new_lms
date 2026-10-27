import { describe, it, expect } from 'vitest';
import { timeAnchorFires, fireDays, istMs } from './lepTimeAnchors.js';
import { fillableWith, reachesLearnerOnDay, TIME_ANCHOR_VARS } from './lepReminderRules.js';

/**
 * Clock-time reminders (day1 / daily / weekly). The ways these go wrong for a learner:
 * a nudge on the wrong day or hour, the same nudge twice, a rituals nudge before the
 * rituals open, or a half-filled message ("Your score this week: .").
 */

// Day 1 is Saturday 31 Oct 2026; S8 four weeks later on Saturday 28 Nov.
const BATCH = {
  id: 'b1',
  name: '31st Oct batch',
  day1Date: '2026-10-31',
  sessions: [
    { code: 'S1', date: '2026-10-31' },
    { code: 'S2', date: '2026-11-01' },
    { code: 'S8', date: '2026-11-28' },
  ],
};
const rule = (code, anchor, body = 'Hi {{name}}') => ({ code, anchor, body, title: code });
const ALL_TIME = [0, Date.parse('2030-01-01')];

describe('when a clock-time reminder fires', () => {
  it('day1: one day relative to Day 1, at the IST time', () => {
    const fires = timeAnchorFires(BATCH, rule('C04', { type: 'day1', dayOffset: -1, time: '10:00' }), ...ALL_TIME);
    expect(fires).toHaveLength(1);
    expect(fires[0].day).toBe('2026-10-30');
    expect(new Date(fires[0].fireAtMs).toISOString()).toBe('2026-10-30T04:30:00.000Z'); // 10:00 IST
  });

  it('daily: every day from Day 1 to the last core session by default', () => {
    const days = fireDays(BATCH, rule('X', { type: 'daily', time: '09:00' }));
    expect(days[0].day).toBe('2026-10-31');
    expect(days[days.length - 1].day).toBe('2026-11-28');
    expect(days).toHaveLength(29);
  });

  it('rituals start on Week 1 Monday, not on the two full days', () => {
    const days = fireDays(BATCH, rule('RITUALS-AM', { type: 'daily', time: '07:00' }));
    expect(days[0]).toEqual({ day: '2026-11-02', offset: 2 });
  });

  it('a CX-set From / To day wins over the default window', () => {
    const days = fireDays(BATCH, rule('RITUALS-AM', { type: 'daily', time: '07:00', fromDay: 5, toDay: 6 }));
    expect(days.map((d) => d.day)).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('weekly: only the chosen weekday inside the window', () => {
    const days = fireDays(BATCH, rule('SCORE', { type: 'weekly', weekday: 'Sat', time: '12:00' }));
    expect(days.map((d) => d.day)).toEqual(['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);
  });

  it('only fires inside the 15-minute scheduler window', () => {
    const at = istMs('2026-11-03', '07:00');
    const r = rule('RITUALS-AM', { type: 'daily', time: '07:00' });
    expect(timeAnchorFires(BATCH, r, at - 15 * 60000, at)).toHaveLength(1);
    expect(timeAnchorFires(BATCH, r, at + 1, at + 15 * 60000)).toHaveLength(0);
  });

  it('dedupe key is per batch, rule and day — a re-run never sends twice', () => {
    const at = istMs('2026-11-03', '07:00');
    const [a] = timeAnchorFires(BATCH, rule('RITUALS-AM', { type: 'daily', time: '07:00' }), at - 1, at);
    expect(a.dedupeKey).toBe('b1|RITUALS-AM|daily|2026-11-03');
  });

  it('sends nothing without a Day 1 date or a valid time', () => {
    expect(timeAnchorFires({ ...BATCH, day1Date: '' }, rule('X', { type: 'daily', time: '07:00' }), ...ALL_TIME)).toEqual([]);
    expect(timeAnchorFires(BATCH, rule('X', { type: 'daily', time: '' }), ...ALL_TIME)).toEqual([]);
  });
});

describe('who gets it, and whether it can be sent yet', () => {
  it('part-paid learners hear nothing after Day 2', () => {
    expect(reachesLearnerOnDay(-1, 'register')).toBe(true);
    expect(reachesLearnerOnDay(1, 'register')).toBe(true);
    expect(reachesLearnerOnDay(2, 'register')).toBe(false);
    expect(reachesLearnerOnDay(20, 'paid')).toBe(true);
  });

  it('holds a message whose text needs data the server does not have', () => {
    expect(fillableWith({ body: 'Good morning {{name}}. Tick today’s 5 Rituals.' }, TIME_ANCHOR_VARS)).toBe(true);
    expect(fillableWith({ body: 'Your 5 Rituals score this week: {{score}}.' }, TIME_ANCHOR_VARS)).toBe(false);
    expect(fillableWith({ title: '{{task}} due', body: 'x' }, TIME_ANCHOR_VARS)).toBe(false);
  });
});
