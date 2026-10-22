import { describe, it, expect } from 'vitest';
import { getTaskDurationHint } from './lepProgramUtils';
import { TASK_TYPES } from '../services/mbwService';

/*
 * LEP's lesson labels in course content. No lesson stores a duration, so no
 * label may claim one.
 */
describe('LEP lesson labels', () => {
  it('never states a duration it does not have', () => {
    for (const type of Object.values(TASK_TYPES)) {
      expect(getTaskDurationHint({ type }), type).not.toMatch(/min|hour|hr/i);
    }
    expect(getTaskDurationHint({})).not.toMatch(/min/i);
  });

  it('names each kind of lesson', () => {
    expect(getTaskDurationHint({ type: TASK_TYPES.WATCH_ONLY })).toBe('Video');
    expect(getTaskDurationHint({ type: TASK_TYPES.LINK })).toBe('Link');
    expect(getTaskDurationHint({ type: TASK_TYPES.EDITABLE_TEMPLATE })).toBe('Template');
  });

  it('keeps the weekly post count, which is real task data', () => {
    expect(getTaskDurationHint({ type: TASK_TYPES.RECURRING_POST, postsPerWeek: 3 })).toBe(
      '3/week'
    );
  });
});
