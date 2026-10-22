import { describe, it, expect } from 'vitest';
import { TASK_TYPE_ICONS, taskTypeIcon } from './taskTypeIcons';
import { TASK_TYPES } from '../../../services/mbwService';
import { getTaskTypeIcon as mbwIcon } from '../../../utils/mbwProgramUtils';
import { getTaskTypeIcon as bm100Icon } from '../../../utils/bm100ProgramUtils';
import { getTaskTypeIcon as lepIcon } from '../../../utils/lepProgramUtils';

/**
 * Task-type symbols.
 *
 * A wrong icon still renders, so nothing here fails loudly on its own — a
 * checklist showing a play button looked fine for as long as nobody read it.
 * These pin the mapping instead.
 */

const ALL_TYPES = Object.values(TASK_TYPES);

/** lucide exports icons as objects, and its display names do not always match
 *  the import name — PlayCircle reports as "CirclePlay". */
const iconName = (c) => c?.displayName || c?.name || '';

describe('every task type has its own symbol', () => {
  it.each([
    ['mbw', mbwIcon],
    ['100bm', bm100Icon],
    ['lep', lepIcon],
  ])('%s maps every type to a defined icon', (_name, getIcon) => {
    for (const type of ALL_TYPES) {
      const key = getIcon(type);
      expect(TASK_TYPE_ICONS[key], `${type} -> "${key}" has no icon`).toBeTruthy();
    }
  });

  it.each([
    ['mbw', mbwIcon],
    ['100bm', bm100Icon],
    ['lep', lepIcon],
  ])('%s gives no two types the same symbol', (_name, getIcon) => {
    const keys = ALL_TYPES.map(getIcon);
    expect(new Set(keys).size).toBe(ALL_TYPES.length);
  });

  it('keeps the three programmes in step with each other', () => {
    for (const type of ALL_TYPES) {
      expect(bm100Icon(type)).toBe(mbwIcon(type));
      expect(lepIcon(type)).toBe(mbwIcon(type));
    }
  });
});

describe('the symbols say what the task is', () => {
  it('shows a play button for something you watch, not a camcorder', () => {
    expect(mbwIcon(TASK_TYPES.WATCH_ONLY)).toBe('video');
    // lucide reports PlayCircle as "CirclePlay".
    expect(iconName(TASK_TYPE_ICONS.video)).toMatch(/play/i);
  });

  it('shows a camcorder for a video you record, not a microphone', () => {
    // A video assignment carried a mic — an audio symbol for a video task.
    expect(mbwIcon(TASK_TYPES.VIDEO_RECORD)).toBe('recording');
    const n = iconName(TASK_TYPE_ICONS.recording);
    expect(n).toMatch(/video/i);
    expect(n).not.toMatch(/mic/i);
  });

  it('separates a repeated post from a one-off link', () => {
    expect(mbwIcon(TASK_TYPES.RECURRING_POST)).not.toBe(mbwIcon(TASK_TYPES.LINK));
  });

  it('gives a checklist a checklist, not the fallback', () => {
    expect(mbwIcon(TASK_TYPES.CHECKLIST)).toBe('checklist');
    expect(TASK_TYPE_ICONS.checklist).not.toBe(TASK_TYPE_ICONS.lesson);
  });

  it('never falls back to a play button for an unknown type', () => {
    // An unrecognised task is not a video; the fallback must stay neutral.
    expect(taskTypeIcon('something-new')).toBe(TASK_TYPE_ICONS.lesson);
    expect(iconName(TASK_TYPE_ICONS.lesson)).not.toMatch(/play/i);
  });
});
