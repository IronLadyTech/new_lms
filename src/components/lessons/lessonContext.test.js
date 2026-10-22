import { describe, it, expect } from 'vitest';
import { splitSectionTitle, taskActionLabel } from './lessonContext';
import { TASK_TYPES } from '../../services/mbwService';

describe('a section title in course content', () => {
  it('splits the day or week off as a label', () => {
    expect(splitSectionTitle('Day 2 — Strategies and Tactics')).toEqual({
      eyebrow: 'Day 2',
      name: 'Strategies and Tactics',
    });
    expect(splitSectionTitle('Week 3 — Progress Review and Guiding Stars')).toEqual({
      eyebrow: 'Week 3',
      name: 'Progress Review and Guiding Stars',
    });
  });

  it('invents no label for a section without one', () => {
    expect(splitSectionTitle('Program Orientation')).toEqual({
      eyebrow: '',
      name: 'Program Orientation',
    });
    expect(splitSectionTitle('')).toEqual({ eyebrow: '', name: '' });
  });
});

describe('what a lesson asks of the learner', () => {
  it('names the action for each kind of assignment', () => {
    expect(taskActionLabel(TASK_TYPES.EDITABLE_TEMPLATE)).toBe('Fill template');
    expect(taskActionLabel(TASK_TYPES.FILE_UPLOAD)).toBe('Upload files');
    expect(taskActionLabel(TASK_TYPES.CHECKLIST)).toBe('Checklist');
  });

  it('adds nothing for a watch-only lesson, whose video already says it', () => {
    expect(taskActionLabel(TASK_TYPES.WATCH_ONLY)).toBe('');
  });

  it('never states a duration, because no lesson stores one', () => {
    for (const type of Object.values(TASK_TYPES)) {
      expect(taskActionLabel(type), type).not.toMatch(/min|hour|hr/i);
    }
  });
});
