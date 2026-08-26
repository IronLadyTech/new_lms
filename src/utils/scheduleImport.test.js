import { describe, it, expect } from 'vitest';
import {
  parseTime,
  parseTimeRange,
  parseScheduleDate,
  parseSchedule,
  findDuplicates,
} from './scheduleImport.js';

/** The 100BM programme runs July 2026 → January 2027. */
const OPTS = { startYear: 2026, startMonth: 5 };

describe('parseTime', () => {
  it('reads 12-hour times', () => {
    expect(parseTime('9:00am')).toBe('09:00');
    expect(parseTime('8:45 PM')).toBe('20:45');
    expect(parseTime('12:30pm')).toBe('12:30');
  });

  it('maps both noon and midnight correctly', () => {
    expect(parseTime('12:00am')).toBe('00:00');
    expect(parseTime('12:00pm')).toBe('12:00');
  });

  it('rejects nonsense rather than guessing', () => {
    expect(parseTime('25:00pm')).toBeNull();
    expect(parseTime('9:70am')).toBeNull();
    expect(parseTime('sometime')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
});

describe('parseTimeRange', () => {
  it('splits on "to" and on dashes', () => {
    expect(parseTimeRange('9:00am to 12:00pm')).toEqual({ time: '09:00', endTime: '12:00' });
    expect(parseTimeRange('8:00pm–8:45pm')).toEqual({ time: '20:00', endTime: '20:45' });
  });

  it('copes with no end time', () => {
    expect(parseTimeRange('9:00am')).toEqual({ time: '09:00', endTime: null });
  });
});

describe('parseScheduleDate', () => {
  it('reads the deck’s date format', () => {
    expect(parseScheduleDate('11th July', OPTS)).toBe('2026-07-11');
    expect(parseScheduleDate('01st Aug', OPTS)).toBe('2026-08-01');
    expect(parseScheduleDate('3rd Oct', OPTS)).toBe('2026-10-03');
  });

  it('rolls into the next year once the programme passes December', () => {
    expect(parseScheduleDate('09th Jan', OPTS)).toBe('2027-01-09');
    expect(parseScheduleDate('16th Jan', OPTS)).toBe('2027-01-16');
  });

  it('keeps pre-programme months in the starting year', () => {
    expect(parseScheduleDate('10th June', OPTS)).toBe('2026-06-10');
  });

  it('rejects impossible dates instead of rolling them forward', () => {
    expect(parseScheduleDate('31st April', OPTS)).toBeNull();
    expect(parseScheduleDate('32nd May', OPTS)).toBeNull();
    expect(parseScheduleDate('someday', OPTS)).toBeNull();
  });
});

describe('parseSchedule', () => {
  const row = (d, t, dt, c, dl) => [d, t, dt, c, dl].join('\t');

  it('reads a well-formed row', () => {
    const { sessions, problems } = parseSchedule(
      row('Saturday', '9:00am to 12:00pm', '11th July', 'Session 1 Board Member Image Creation', 'Create an imperfect Video Script'),
      OPTS
    );
    expect(problems).toHaveLength(0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-07-11');
    expect(sessions[0].time).toBe('09:00');
    expect(sessions[0].endTime).toBe('12:00');
    expect(sessions[0].title).toBe('Session 1 Board Member Image Creation');
    expect(sessions[0].description).toContain('Deliverable: Create an imperfect Video Script');
    expect(sessions[0].warning).toBeNull();
  });

  it('skips a repeated header row without reporting it', () => {
    const { sessions, problems } = parseSchedule(
      ['Day\tTime\tDate\tContent\tDeliverable',
       row('Saturday', '8:00am to 8:45am', '18th July', 'Imperfect Brand Video Session', 'Video')].join('\n'),
      OPTS
    );
    expect(sessions).toHaveLength(1);
    expect(problems).toHaveLength(0);
  });

  it('flags a weekday that does not match the date', () => {
    const { sessions } = parseSchedule(
      row('Monday', '9:00am to 12:00pm', '11th July', 'Session 1', 'X'), OPTS
    );
    expect(sessions[0].warning).toMatch(/Monday.*Saturday/);
  });

  it('flags an end time before the start, rather than importing it silently', () => {
    // The deck really does say "9:00am to 12:30am" for 29th Aug.
    const { sessions } = parseSchedule(
      row('Saturday', '9:00am to 12:30am', '29th Aug', 'Session 3 - Capability matrix', 'Video'), OPTS
    );
    expect(sessions[0].warning).toMatch(/Ends before it starts/);
  });

  it('reports unreadable rows instead of dropping them', () => {
    const { sessions, problems } = parseSchedule(
      [row('Saturday', 'whenever', '11th July', 'Session 1', 'X'),
       row('Saturday', '9:00am', 'the 40th of Foo', 'Session 2', 'X'),
       'just some prose'].join('\n'),
      OPTS
    );
    expect(sessions).toHaveLength(0);
    expect(problems).toHaveLength(2);
    expect(problems[0].reason).toMatch(/time/);
    expect(problems[1].reason).toMatch(/date/);
  });

  it('folds a multi-line Content cell into one session', () => {
    // Copying from the deck splits a bullet list across lines; they belong to
    // the row above, not to a session of their own.
    const { sessions, problems } = parseSchedule(
      [row('Saturday', '9:00am to 12:00pm', '11th July', 'Session 1 Board Member Image Creation', 'Video script'),
       '• Redefine Boardmember',
       '• Breakthrough target setting'].join('\n'),
      OPTS
    );
    expect(problems).toHaveLength(0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Session 1 Board Member Image Creation');
    expect(sessions[0].description).toContain('Redefine Boardmember');
    expect(sessions[0].description).toContain('Breakthrough target setting');
  });

  it('accepts columns separated by wide spaces, not just tabs', () => {
    const { sessions } = parseSchedule(
      'Saturday    8:00am to 8:45am    25th July    Resume and Differentiated Brand    Create your CV',
      OPTS
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-07-25');
  });

  it('ignores blank lines', () => {
    const { sessions, problems } = parseSchedule(
      ['', row('Saturday', '9:00am to 12:00pm', '11th July', 'Session 1', 'X'), '   '].join('\n'),
      OPTS
    );
    expect(sessions).toHaveLength(1);
    expect(problems).toHaveLength(0);
  });
});

describe('findDuplicates', () => {
  it('matches on date and title, ignoring case and padding', () => {
    const sessions = [
      { date: '2026-07-11', title: 'Session 1' },
      { date: '2026-07-18', title: 'Session 2' },
    ];
    const existing = [{ date: '2026-07-11', title: '  session 1  ' }];
    expect(findDuplicates(sessions, existing)).toEqual([sessions[0]]);
  });

  it('returns nothing when the calendar is empty', () => {
    expect(findDuplicates([{ date: '2026-07-11', title: 'A' }], [])).toEqual([]);
  });
});
