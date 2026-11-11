import { describe, it, expect } from 'vitest';
import { ritualsCopy, BY_WEEKDAY, weekdayIst } from './lepRitualsCopy.js';

/** The 7 AM rituals message: a different ritual each day, in the senior-leader voice. */
describe('morning rituals message', () => {
  it('each weekday has its own ritual', () => {
    expect(weekdayIst('2026-11-23')).toBe(1); // Monday
    expect(ritualsCopy('RITUALS-AM', '2026-11-23', { name: 'Asha' })).toEqual({
      title: 'Before your first meeting',
      body: 'Asha, lead yourself before you lead the room. 5 Rituals, ten minutes.',
    });
    expect(ritualsCopy('RITUALS-AM', '2026-11-24', {}).title).toBe('One bold ask today');
    expect(new Set(Object.values(BY_WEEKDAY).map(([t]) => t)).size).toBe(7);
  });
  it('without her name, a clean sentence', () => {
    expect(ritualsCopy('RITUALS-AM', '2026-11-23', { name: 'there' }).body).toBe(
      'Lead yourself before you lead the room. 5 Rituals, ten minutes.'
    );
  });
  it('other rules keep their CMS text', () => {
    expect(ritualsCopy('RITUALS-PM', '2026-11-23', {})).toBeNull();
  });
  it('lock-screen length and tone', () => {
    for (const [title, body] of Object.values(BY_WEEKDAY)) {
      const b = body.replace('{{name}}', 'Rajalakshmi');
      expect(title.length, title).toBeLessThanOrEqual(40);
      expect(b.length, b).toBeLessThanOrEqual(80);
      expect(`${title} ${b}`).not.toMatch(/[!]|\p{Extended_Pictographic}/u);
    }
  });
});
