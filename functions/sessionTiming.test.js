import { describe, it, expect } from 'vitest';
import { sessionWindow, WINDOW_MS } from './lepNotificationScheduler.js';
import { sessionAnchorFires } from './lepNotificationAnchors.js';

/**
 * Three messages per session: 1 hour before, 15 minutes before, and when it is live.
 * The scheduler runs every 5 minutes at whatever minute Google starts it. "Before" messages
 * must never arrive late; "live" must never arrive before the start.
 */
const START = Date.parse('2026-11-14T09:00:00+05:30');
const batch = {
  id: 'b14',
  sessions: [{ code: 'S1', title: 'Day 1', date: '2026-11-14', startAt: '2026-11-14T09:00:00+05:30', joinLink: 'z' }],
};
const ev = (code, offsetMinutes) => ({ code, anchor: { type: 'sessionStart', ref: '*', offsetMinutes } });

/** When each message is sent, for runs every 5 minutes starting at `phaseMin` past the hour. */
function sendTimes(event, phaseMin) {
  const sent = [];
  for (let t = START - 3 * 3600000 + phaseMin * 60000; t < START + 3600000; t += WINDOW_MS) {
    const fires = sessionAnchorFires(batch, event, ...sessionWindow(event, t));
    for (const f of fires) if (!sent.some((s) => s.key === f.dedupeKey)) sent.push({ key: f.dedupeKey, at: t });
  }
  return sent.map((s) => (s.at - START) / 60000); // minutes relative to the start
}

describe('session reminder timing (any run phase)', () => {
  for (const phase of [0, 1, 2, 3, 4]) {
    it(`runs at :0${phase}: each message exactly once, at the right moment`, () => {
      const h1 = sendTimes(ev('R-1h', -60), phase);
      const m15 = sendTimes(ev('R-15m', -15), phase);
      const live = sendTimes(ev('R-LIVE', 0), phase);
      expect(h1).toHaveLength(1);
      expect(m15).toHaveLength(1);
      expect(live).toHaveLength(1);
      // 1 hour: between 65 and 60 minutes before.
      expect(h1[0]).toBeGreaterThanOrEqual(-65);
      expect(h1[0]).toBeLessThanOrEqual(-60);
      // 15 minutes: between 20 and 15 minutes before — never after.
      expect(m15[0]).toBeGreaterThanOrEqual(-20);
      expect(m15[0]).toBeLessThanOrEqual(-15);
      // Live: at the start or up to 5 minutes after — never before.
      expect(live[0]).toBeGreaterThanOrEqual(0);
      expect(live[0]).toBeLessThanOrEqual(5);
    });
  }
});
