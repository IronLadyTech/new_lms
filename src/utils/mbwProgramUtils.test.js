import { describe, expect, it } from 'vitest';
import { getProgramProgressPct } from './mbwProgramUtils.js';

describe('getProgramProgressPct', () => {
  it('returns 0 when total is zero', () => {
    expect(getProgramProgressPct(0, 0)).toBe(0);
  });

  it('rounds percentage of completed milestones', () => {
    expect(getProgramProgressPct(1, 4)).toBe(25);
    expect(getProgramProgressPct(3, 4)).toBe(75);
    expect(getProgramProgressPct(4, 4)).toBe(100);
  });
});
