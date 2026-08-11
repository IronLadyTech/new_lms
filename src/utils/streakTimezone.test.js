import { describe, it, expect } from 'vitest';
import {
  STREAK_TIMEZONE,
  toValidDate,
  getDateKey,
  parseDateKey,
  addDaysToKey,
  isWeekendKey,
  daysBetweenKeys,
  enumerateDateKeys,
  getWeekdayIndex,
} from './streakTimezone';

/**
 * Streaks and attendance are counted in calendar days, pinned to IST regardless
 * of where the learner or the server is. Off-by-one here silently breaks a
 * learner's streak, which is the feature most visible to them.
 */

describe('toValidDate', () => {
  it('accepts Firestore timestamps, seconds objects, Dates, and ISO strings', () => {
    const expected = Date.UTC(2026, 2, 4, 10, 0, 0);
    expect(toValidDate({ toDate: () => new Date(expected) }).getTime()).toBe(expected);
    expect(toValidDate({ seconds: expected / 1000 }).getTime()).toBe(expected);
    expect(toValidDate(new Date(expected)).getTime()).toBe(expected);
    expect(toValidDate('2026-03-04T10:00:00Z').getTime()).toBe(expected);
  });

  it('returns null for anything unusable rather than an Invalid Date', () => {
    expect(toValidDate(null)).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
    expect(toValidDate('')).toBeNull();
    expect(toValidDate('gibberish')).toBeNull();
    expect(toValidDate(new Date('gibberish'))).toBeNull();
    expect(toValidDate({ toDate: () => new Date('gibberish') })).toBeNull();
  });
});

describe('getDateKey — IST day boundaries', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(getDateKey(new Date('2026-03-04T06:00:00Z'))).toBe('2026-03-04');
  });

  it('counts 19:00 UTC as the NEXT day in IST (+05:30)', () => {
    // 19:00 UTC = 00:30 IST the following day. A learner submitting at
    // 00:30 IST must land on the new day, not the old one.
    expect(getDateKey(new Date('2026-03-04T19:00:00Z'))).toBe('2026-03-05');
  });

  it('counts 18:00 UTC as still the same IST day', () => {
    // 18:00 UTC = 23:30 IST — the last half hour of the day.
    expect(getDateKey(new Date('2026-03-04T18:00:00Z'))).toBe('2026-03-04');
  });

  it('is timezone-pinned, not dependent on the machine', () => {
    expect(STREAK_TIMEZONE).toBe('Asia/Kolkata');
  });

  it('returns null for an unusable date', () => {
    expect(getDateKey('gibberish')).toBeNull();
  });
});

describe('addDaysToKey', () => {
  it('moves forward and backward', () => {
    expect(addDaysToKey('2026-03-04', 1)).toBe('2026-03-05');
    expect(addDaysToKey('2026-03-04', -1)).toBe('2026-03-03');
    expect(addDaysToKey('2026-03-04', 0)).toBe('2026-03-04');
  });

  it('crosses month and year boundaries', () => {
    expect(addDaysToKey('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2028-02-29', 1)).toBe('2028-03-01');
    // 2026 is not a leap year.
    expect(addDaysToKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('spans a long streak without drifting', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 365; i++) key = addDaysToKey(key, 1);
    expect(key).toBe('2027-01-01');
  });
});

describe('parseDateKey', () => {
  it('anchors at midday UTC so DST shifts cannot flip the day', () => {
    expect(parseDateKey('2026-03-04').getUTCHours()).toBe(12);
    expect(parseDateKey('2026-03-04').getUTCDate()).toBe(4);
  });
});

describe('daysBetweenKeys', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetweenKeys('2026-03-01', '2026-03-04')).toBe(3);
    expect(daysBetweenKeys('2026-03-04', '2026-03-01')).toBe(-3);
    expect(daysBetweenKeys('2026-03-04', '2026-03-04')).toBe(0);
  });

  it('is exact across a month and a year', () => {
    expect(daysBetweenKeys('2026-01-01', '2026-02-01')).toBe(31);
    expect(daysBetweenKeys('2026-01-01', '2027-01-01')).toBe(365);
  });
});

describe('enumerateDateKeys', () => {
  it('includes both ends', () => {
    expect(enumerateDateKeys('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(enumerateDateKeys('2026-03-04', '2026-03-04')).toEqual(['2026-03-04']);
  });

  it('returns nothing when the range is inverted — never loops forever', () => {
    expect(enumerateDateKeys('2026-03-04', '2026-03-01')).toEqual([]);
  });

  it('produces a full month', () => {
    expect(enumerateDateKeys('2026-04-01', '2026-04-30')).toHaveLength(30);
  });
});

describe('isWeekendKey / getWeekdayIndex', () => {
  it('identifies Saturday and Sunday', () => {
    // 2026-03-07 is a Saturday, 2026-03-08 a Sunday.
    expect(isWeekendKey('2026-03-07')).toBe(true);
    expect(isWeekendKey('2026-03-08')).toBe(true);
  });

  it('identifies weekdays', () => {
    expect(isWeekendKey('2026-03-04')).toBe(false); // Wednesday
    expect(isWeekendKey('2026-03-06')).toBe(false); // Friday
    expect(isWeekendKey('2026-03-09')).toBe(false); // Monday
  });

  it('maps Sunday to 0 and Saturday to 6', () => {
    expect(getWeekdayIndex(parseDateKey('2026-03-08'))).toBe(0);
    expect(getWeekdayIndex(parseDateKey('2026-03-07'))).toBe(6);
  });
});
