import { describe, it, expect } from 'vitest';
import { programTag, withProgram } from './programTag.js';

/** A learner in LEP and 100BM must see at a glance which programme a reminder is about. */
describe('programme in the title', () => {
  it('LEP, 100BM and MBW, however the batch spells it', () => {
    expect(programTag('LEP')).toBe('LEP');
    expect(programTag('100BM')).toBe('100BM');
    expect(programTag('100 BM')).toBe('100BM');
    expect(programTag('bm100')).toBe('100BM');
    expect(programTag('mbw')).toBe('MBW');
    expect(programTag('')).toBe('LEP');
  });
  it('goes in front of the title, once', () => {
    expect(withProgram('LEP', 'Day 1 starts in 15 minutes')).toBe('LEP · Day 1 starts in 15 minutes');
    expect(withProgram('100BM', 'Session in 1 hour')).toBe('100BM · Session in 1 hour');
    expect(withProgram('LEP', 'LEP · Day 1 is live')).toBe('LEP · Day 1 is live');
  });
});
