import { describe, it, expect } from 'vitest';
import { sessionCopy, COPY, slotOf } from './lepSessionCopy.js';

/** Every session reminder: the fact in the title, one true line in the body, lock-screen length. */
describe('session reminder words', () => {
  it('Day 1, 15 minutes before', () => {
    expect(sessionCopy('R-15m', 'S1', { name: 'Asha', time: '9:00 AM' })).toEqual({
      title: 'Day 1 starts in 15 minutes',
      body: 'Bring the leader you want to be. She is closer than you think.',
    });
  });
  it('her first name when known; a clean sentence when not', () => {
    expect(sessionCopy('R-24h', 'S1', { name: 'Asha', time: '9:00 AM' }).body).toBe(
      'Asha, keep the day clear. The woman you are becoming starts here.'
    );
    expect(sessionCopy('R-24h', 'S1', { name: 'there', time: '9:00 AM' }).body).toBe(
      'Keep the day clear. The woman you are becoming starts here.'
    );
  });
  it('time in the title the day before; no time = the CMS text instead', () => {
    expect(sessionCopy('R-24h', 'S1', { time: '9:00 AM' }).title).toBe('Day 1 is tomorrow at 9:00 AM');
    expect(sessionCopy('R-24h', 'S1', { time: '' })).toBeNull();
  });
  it('optional sessions: 15 minutes and live; every Prepare to Win week shares the words', () => {
    expect(sessionCopy('OPT-R-15m-PTW', 'PTW3', {}).title).toBe('Prepare to Win in 15 minutes');
    expect(sessionCopy('OPT-R-LIVE', 'FT', {}).title).toBe('Fast Track is live');
  });
  it('unknown session or reminder: null, so the CMS text is used', () => {
    expect(sessionCopy('R-15m', 'S99', {})).toBeNull();
    expect(sessionCopy('TASK-DUE', 'S1', {})).toBeNull();
    expect(slotOf('R-10m')).toBeNull();
  });
  it('every line fits the lock screen and keeps the tone rules', () => {
    for (const [code, slots] of Object.entries(COPY)) {
      for (const [slot, [title, body]] of Object.entries(slots)) {
        const t = title.replace('{{time}}', '12:30 PM');
        const b = body.replace('{{name}}', 'Rajalakshmi').replace('{{time}}', '12:30 PM');
        expect(t.length, `${code} ${slot} title`).toBeLessThanOrEqual(40);
        expect(b.length, `${code} ${slot} body`).toBeLessThanOrEqual(80);
        expect(`${t} ${b}`, `${code} ${slot}`).not.toMatch(/[!]|https?:|\p{Extended_Pictographic}/u);
      }
    }
  });
});
