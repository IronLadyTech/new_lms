import { describe, it, expect } from 'vitest';
import { getModuleLabel, getWeekCode, getPrimaryStatus, submissionPreview } from './mbwDisplay';
import {
  getProgramTasksForRecordings,
  hasProgramRecordingSessions,
  getBatchRecordingSessions,
  getSessionTitle,
  findRecordingForSession,
} from './batchRecordingSessions';
import { SUBMISSION_STATUS } from '../services/mbwService';
import { PROGRAMS } from '../data/programTypes';

describe('getModuleLabel / getWeekCode', () => {
  it('numbers modules from 1, not 0', () => {
    expect(getModuleLabel({ order: 0, title: 'Orientation' })).toBe('Module 1 — Orientation');
    expect(getModuleLabel({ order: 4, title: 'Warfare Map' })).toBe('Module 5 — Warfare Map');
  });

  it('copes with a task that has no order', () => {
    expect(getModuleLabel({ title: 'Untitled' })).toBe('Module 1 — Untitled');
  });

  it('returns an empty week code rather than undefined', () => {
    expect(getWeekCode({ week: 'Wk3' })).toBe('Wk3');
    expect(getWeekCode({})).toBe('');
  });
});

describe('getPrimaryStatus', () => {
  it('always returns a label and a tone', () => {
    for (const status of Object.values(SUBMISSION_STATUS)) {
      const result = getPrimaryStatus(status, false);
      expect(result.label).toBeTruthy();
      expect(result.tone).toBeTruthy();
    }
  });

  it('shows submitted work as submitted, not still open', () => {
    expect(getPrimaryStatus(SUBMISSION_STATUS.SUBMITTED, false).label).toBe('Submitted');
    expect(getPrimaryStatus(SUBMISSION_STATUS.UNDER_REVIEW, false).label).toBe('Submitted');
  });

  it('shows completed work as completed', () => {
    expect(getPrimaryStatus(SUBMISSION_STATUS.COMPLETED, true).label).toBe('Completed');
    expect(getPrimaryStatus(SUBMISSION_STATUS.UNLOCKED, true).label).toBe('Completed');
  });

  it('surfaces work the learner must act on ahead of generic progress', () => {
    const result = getPrimaryStatus(SUBMISSION_STATUS.NEEDS_IMPROVEMENT, false);
    expect(result.label).toBeTruthy();
    expect(result.label).not.toBe('In progress');
  });

  it('marks locked work as locked', () => {
    expect(getPrimaryStatus(SUBMISSION_STATUS.LOCKED, false).label).toBe('Locked');
  });
});

describe('submissionPreview', () => {
  it('returns null when there is nothing to preview', () => {
    expect(submissionPreview(null, {})).toBeNull();
    expect(submissionPreview({}, {})).toBeNull();
  });

  it('flags device-only saves so the learner knows sync is pending', () => {
    expect(submissionPreview({ _local: true }, {})).toMatch(/device/i);
  });

  it('previews text, trimmed and capped', () => {
    expect(submissionPreview({ textValue: '  my answer  ' }, {})).toBe('my answer');
    expect(submissionPreview({ textValue: 'x'.repeat(300) }, {})).toHaveLength(120);
  });

  it('previews a link and a file name', () => {
    expect(submissionPreview({ linkValue: ' https://x.com ' }, {})).toBe('https://x.com');
    expect(submissionPreview({ fileName: 'plan.pdf' }, {})).toBe('plan.pdf');
  });

  it('describes template submissions by shape', () => {
    expect(
      submissionPreview({ templateData: { templateId: 'delta', rows: [1, 2, 3] } }, {})
    ).toMatch(/Delta table \(3 milestones\)/);
    expect(submissionPreview({ templateData: { templateId: 'errc', rows: [1, 2] } }, {})).toMatch(
      /ERRC grid \(2 rows\)/
    );
  });

  it('counts checklist progress against the task total', () => {
    expect(submissionPreview({ checkedItems: [1, 2] }, { checklistItems: [1, 2, 3, 4] })).toBe(
      '2/4 practices done'
    );
  });

  it('falls back to "Video watched" for a watch-only completion', () => {
    expect(submissionPreview({ watchCompleted: true }, {})).toBe('Video watched');
  });
});

describe('batchRecordingSessions', () => {
  it('knows which programmes have session recordings', () => {
    expect(hasProgramRecordingSessions(PROGRAMS.MBW)).toBe(true);
    expect(hasProgramRecordingSessions(PROGRAMS.BM100)).toBe(true);
    expect(hasProgramRecordingSessions(PROGRAMS.LEP)).toBe(false);
    expect(hasProgramRecordingSessions(undefined)).toBe(false);
  });

  it('returns tasks for a real programme and nothing for others', () => {
    expect(getProgramTasksForRecordings(PROGRAMS.MBW).length).toBeGreaterThan(0);
    expect(getProgramTasksForRecordings('nope')).toEqual([]);
  });

  it('returns no sessions without a phase id', () => {
    expect(getBatchRecordingSessions(PROGRAMS.MBW, null)).toEqual([]);
    expect(getBatchRecordingSessions(PROGRAMS.MBW, '')).toEqual([]);
  });

  it('gives every session an id and a title', () => {
    const tasks = getProgramTasksForRecordings(PROGRAMS.MBW);
    const phaseId = tasks[0]?.phase;
    for (const session of getBatchRecordingSessions(PROGRAMS.MBW, phaseId)) {
      expect(session.id).toBeTruthy();
      expect(session.title).toBeTruthy();
      expect(typeof session.week).toBe('string');
    }
  });

  it('returns an empty title for an unknown session rather than undefined', () => {
    expect(getSessionTitle(PROGRAMS.MBW, 'no-such-session')).toBe('');
    expect(getSessionTitle(PROGRAMS.MBW, null)).toBe('');
  });

  it('finds a recording for a session and null when there is none', () => {
    const recordings = [{ sessionId: 's1', phaseId: 'p1', url: 'https://x' }];
    expect(findRecordingForSession(recordings, 'p1', 's1')?.url).toBe('https://x');
    expect(findRecordingForSession(recordings, 'p1', 's2')).toBeNull();
    expect(findRecordingForSession([], 'p1', 's1')).toBeNull();
    expect(findRecordingForSession(recordings, 'p1', null)).toBeNull();
  });

  it('still matches a legacy recording saved without a phase', () => {
    const recordings = [{ sessionId: 's1', url: 'https://x' }];
    expect(findRecordingForSession(recordings, 'p1', 's1')?.url).toBe('https://x');
  });
});
