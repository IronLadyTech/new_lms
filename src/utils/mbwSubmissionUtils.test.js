import { describe, it, expect } from 'vitest';
import {
  hasSubmissionContent,
  filterSavedTaskStates,
  countSavedSubmissions,
} from './mbwSubmissionUtils';
import { getTaskKindLabel } from './taskKindLabel';
import { SUBMISSION_STATUS, TASK_TYPES } from '../services/mbwService';

describe('hasSubmissionContent', () => {
  it('recognises every shape a learner can submit', () => {
    expect(hasSubmissionContent({ textValue: 'answer' })).toBe(true);
    expect(hasSubmissionContent({ linkValue: 'https://x' })).toBe(true);
    expect(hasSubmissionContent({ fileUrl: 'f' })).toBe(true);
    expect(hasSubmissionContent({ videoUrl: 'v' })).toBe(true);
    expect(hasSubmissionContent({ templateData: { rows: [] } })).toBe(true);
    expect(hasSubmissionContent({ weekEntries: [{}] })).toBe(true);
    expect(hasSubmissionContent({ watchCompleted: true })).toBe(true);
  });

  it('counts work saved locally when the upload was skipped', () => {
    // Otherwise a learner on a poor connection appears to have submitted nothing.
    expect(hasSubmissionContent({ storageSkipped: true })).toBe(true);
  });

  it('is false for an empty or locked submission', () => {
    expect(hasSubmissionContent({})).toBe(false);
    expect(hasSubmissionContent(null)).toBe(false);
    expect(hasSubmissionContent(undefined)).toBe(false);
    expect(hasSubmissionContent({ status: SUBMISSION_STATUS.LOCKED, textValue: 'x' })).toBe(false);
  });

  it('is false for an empty weekEntries array', () => {
    expect(hasSubmissionContent({ weekEntries: [] })).toBe(false);
  });
});

describe('filterSavedTaskStates / countSavedSubmissions', () => {
  const states = [
    { task: { id: 'a' }, submission: { textValue: 'done' } },
    { task: { id: 'b' }, submission: {} },
    { task: { id: 'c' } },
    { task: { id: 'd' }, submission: { watchCompleted: true } },
  ];

  it('keeps only tasks with real content', () => {
    expect(filterSavedTaskStates(states).map((s) => s.task.id)).toEqual(['a', 'd']);
  });

  it('counts them', () => {
    expect(countSavedSubmissions(states)).toBe(2);
    expect(countSavedSubmissions([])).toBe(0);
  });
});

describe('getTaskKindLabel', () => {
  it('calls submission work an Assignment', () => {
    expect(getTaskKindLabel(TASK_TYPES.EDITABLE_TEMPLATE)).toBe('Assignment');
    expect(getTaskKindLabel(TASK_TYPES.FILE_UPLOAD)).toBe('Assignment');
    expect(getTaskKindLabel(TASK_TYPES.VIDEO_RECORD)).toBe('Assignment');
    expect(getTaskKindLabel(TASK_TYPES.RECURRING_POST)).toBe('Assignment');
  });

  it('calls consumption work a Lesson', () => {
    expect(getTaskKindLabel(TASK_TYPES.WATCH_ONLY)).toBe('Lesson');
  });

  it('defaults to Lesson for an unknown type rather than showing nothing', () => {
    expect(getTaskKindLabel('mystery')).toBe('Lesson');
    expect(getTaskKindLabel(undefined)).toBe('Lesson');
  });
});
