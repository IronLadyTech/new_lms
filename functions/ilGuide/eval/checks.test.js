import { describe, it, expect } from 'vitest';
import checks from './checks.js';

const { scoreResult, firstName } = checks;

const ctx = {
  participantId: 'u1',
  surface: 'home',
  name: 'Dr. Meenakshi S. Narayanan',
  nextTask: { id: 'lep-day1-assignment', title: 'Day 1 Assignment' },
  lepPractice: { practiceDoneToday: 1, practiceTotalToday: 3 },
  lepBatch: { nextSessionTitle: 'Shameless Pitch', nextSessionWhen: 'Thu 6 Nov, 6:30 PM' },
};

const failed = (result, expect) => scoreResult(result, ctx, expect).failures.map((f) => f.check);

/**
 * The scorer is the accuracy gate, so its own mistakes would hide real ones.
 * These pin what each check catches and what it lets through.
 */
describe('IL Guide scoring', () => {
  it('passes a good whisper', () => {
    const r = {
      message: 'Meenakshi, 2 practice items left today. Then Day 1 Assignment before Thu 6 Nov.',
      job: 'nudge',
      taskId: 'lep-day1-assignment',
    };
    expect(
      failed(r, { job: 'nudge', taskId: 'lep-day1-assignment', mention: [['Day 1']] })
    ).toEqual([]);
  });

  it('catches an invented date and number', () => {
    expect(failed({ message: 'Your session is on Fri 7 Nov at 5:00 PM.', job: 'nudge' })).toContain(
      'noInventedDates'
    );
    expect(failed({ message: 'You are 3 tasks ahead of 40 women.', job: 'nudge' })).toContain(
      'noInventedNumbers'
    );
  });

  it('catches an invented quotation but allows a quoted task title', () => {
    expect(
      failed({
        message: '"Courage is grace under pressure, always and forever." — Someone',
        job: 'nudge',
      })
    ).toContain('vettedQuotes');
    expect(failed({ message: 'Start with "Day 1 Assignment" today.', job: 'nudge' })).not.toContain(
      'vettedQuotes'
    );
  });

  it('catches leaks, bot phrasing and surnames', () => {
    expect(failed({ message: 'Welcome, undefined.', job: 'onboard' })).toContain('noLeaks');
    expect(failed({ message: "I'm here to assist you today.", job: 'nudge' })).toContain('voice');
    expect(failed({ message: 'Narayanan, keep going.', job: 'nudge' })).toContain('firstNameOnly');
  });

  it('catches a locked or unknown next step', () => {
    expect(
      failed(
        { message: 'Go on.', job: 'nudge', taskId: 'lep-day5-pitch' },
        { lockedTaskIds: ['lep-day5-pitch'] }
      )
    ).toContain('taskAllowed');
    expect(failed({ message: 'Go on.', job: 'nudge', taskId: 'made-up' })).toContain('taskAllowed');
  });

  it('skips titles when finding the first name', () => {
    expect(firstName('Dr. Meenakshi S. Narayanan')).toBe('Meenakshi');
  });
});

describe('IL Guide voice', () => {
  it('rejects hurtful, salesy and unprofessional wording', () => {
    expect(
      failed({ message: 'You are behind everyone else in your batch.', job: 'nudge' })
    ).toContain('notHurtful');
    expect(failed({ message: 'Pay your balance today to continue.', job: 'nudge' })).toContain(
      'notSales'
    );
    expect(failed({ message: 'Hurry, limited time offer on LEP.', job: 'nudge' })).toContain(
      'notSales'
    );
    expect(failed({ message: 'Great job!! 🎉', job: 'nudge' })).toContain('professional');
    expect(failed({ message: 'Hey there dear, DO THIS NOW.', job: 'nudge' })).toContain(
      'professional'
    );
  });

  it('accepts a professional, goal-focused step', () => {
    const r = {
      message:
        'Meenakshi, enroll to unlock Day 2 and the rest of your journey toward your CHRO goal.',
      job: 'nudge',
    };
    expect(failed(r)).toEqual([]);
  });
});
