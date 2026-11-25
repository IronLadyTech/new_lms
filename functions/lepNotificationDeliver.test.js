import { describe, it, expect } from 'vitest';
import { pushChannelForEvent } from './lepNotificationDeliver.js';

describe('which reminders get the strong session vibration', () => {
  const at = (type, offsetMinutes) => ({ anchor: { type, ref: '*', offsetMinutes } });
  it('starting soon: 60 and 10 minutes before', () => {
    expect(pushChannelForEvent(at('sessionStart', -60))).toBe('session');
    expect(pushChannelForEvent(at('sessionStart', -10))).toBe('session');
  });
  it('not: the day before, two hours before, after the start, or clock-time reminders', () => {
    expect(pushChannelForEvent(at('sessionStart', -1440))).toBe('default');
    expect(pushChannelForEvent(at('sessionStart', -120))).toBe('default');
    expect(pushChannelForEvent(at('sessionStart', 30))).toBe('default');
    expect(pushChannelForEvent(at('sessionEnd', 0))).toBe('default');
    expect(pushChannelForEvent({ anchor: { type: 'daily', time: '07:00' } })).toBe('default');
    expect(pushChannelForEvent(null)).toBe('default');
  });
});
