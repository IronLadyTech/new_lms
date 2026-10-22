import { describe, it, expect } from 'vitest';
import { draftDayLabel, draftSavedLabel } from './templateDrafts';

/**
 * How a draft's save time reads beside the worksheet. It updates while the
 * learner works, so it must say "just now" rather than a clock time that looks
 * stale a minute later.
 */

const NOW = new Date('2026-09-15T21:36:00+05:30');
const ago = (seconds) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe('when a draft was saved', () => {
  it('reads "just now" for the first seconds', () => {
    expect(draftSavedLabel(ago(0), NOW.getTime())).toBe('just now');
    expect(draftSavedLabel(ago(40), NOW.getTime())).toBe('just now');
  });

  it('counts minutes after that', () => {
    expect(draftSavedLabel(ago(60), NOW.getTime())).toBe('1 min ago');
    expect(draftSavedLabel(ago(4 * 60), NOW.getTime())).toBe('4 min ago');
  });

  it('gives the time once it is an hour old', () => {
    expect(draftSavedLabel(ago(2 * 3600), NOW.getTime())).toMatch(/7:36\s?pm/i);
  });

  it('says nothing for a time it cannot read', () => {
    expect(draftSavedLabel('not a date', NOW.getTime())).toBe('');
  });
});

describe('the day a draft was started', () => {
  it('is Today on the same day', () => {
    expect(draftDayLabel(ago(3600), NOW)).toBe('Today');
  });

  it('is the date on an earlier day', () => {
    expect(draftDayLabel(ago(2 * 86400), NOW)).toMatch(/^13 Sept?$/);
  });
});
