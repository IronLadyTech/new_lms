import { describe, it, expect } from 'vitest';
import {
  answerSnapshot,
  appendVersion,
  changedTemplateCells,
  getSubmissionVersions,
} from './submissionVersions';
import { getFormTemplate } from '../data/formTemplates/registry';

/**
 * Versions of a hand-in: what is kept, how an older submission reads, and what
 * counts as a change while editing.
 */

describe('the answer kept in a version', () => {
  it('is the answer alone, never status, review or bookkeeping', () => {
    expect(
      answerSnapshot({
        status: 'submitted',
        type: 'text',
        submittedAt: '2026-09-14T10:00:00Z',
        userId: 'u1',
        taskId: 't1',
        feedback: 'Good',
        reviewHistory: [],
        watchProgress: 0.5,
        textValue: 'My answer',
        templateData: { templateId: 'x', fields: { a: '1' } },
      })
    ).toEqual({
      textValue: 'My answer',
      templateData: { templateId: 'x', fields: { a: '1' } },
    });
  });

  it('leaves out Firestore write sentinels', () => {
    expect(answerSnapshot({ textValue: 'a', extra: { _methodName: 'serverTimestamp' } })).toEqual({
      textValue: 'a',
    });
  });
});

describe('the versions of a submission', () => {
  it('reads a submission from before versions existed as v1', () => {
    expect(
      getSubmissionVersions({
        status: 'submitted',
        submittedAt: '2026-09-14T10:00:00Z',
        textValue: 'first',
      })
    ).toEqual([{ version: 1, submittedAt: '2026-09-14T10:00:00Z', data: { textValue: 'first' } }]);
  });

  it('has none before anything is handed in', () => {
    expect(getSubmissionVersions(null)).toEqual([]);
    expect(getSubmissionVersions({ status: 'unlocked', textValue: 'draft' })).toEqual([]);
  });

  it('keeps the list a submission already carries', () => {
    const versions = [{ version: 1, submittedAt: 'a', data: {} }];
    expect(getSubmissionVersions({ status: 'submitted', versions })).toBe(versions);
  });

  it('adds the next version after the ones handed in', () => {
    const legacy = { status: 'submitted', submittedAt: 'day1', textValue: 'first' };
    const next = appendVersion(legacy, { status: 'submitted', submittedAt: 'day2', textValue: 'second' });
    expect(next).toEqual([
      { version: 1, submittedAt: 'day1', data: { textValue: 'first' } },
      { version: 2, submittedAt: 'day2', data: { textValue: 'second' } },
    ]);
  });

  it('starts at v1 on a first hand-in', () => {
    expect(appendVersion(null, { submittedAt: 'day1', textValue: 'first' })).toEqual([
      { version: 1, submittedAt: 'day1', data: { textValue: 'first' } },
    ]);
  });
});

describe('what changed while editing a worksheet', () => {
  const def = getFormTemplate('key-relationships');
  const row = (relationship, mattersToYou = '', mattersToThem = '') => ({
    relationship,
    mattersToYou,
    mattersToThem,
  });

  it('names each table cell that differs', () => {
    const before = { relationships: [row('Manager', 'Trust', 'Delivery')] };
    const after = { relationships: [row('Manager', 'Trust and time', 'Delivery'), row('Mentor')] };
    expect([...changedTemplateCells(def, before, after)].sort()).toEqual([
      'relationships:0:mattersToYou',
      'relationships:1:relationship',
    ]);
  });

  it('does not count whitespace as a change', () => {
    const before = { relationships: [row('Manager')] };
    const after = { relationships: [row('  Manager ')] };
    expect(changedTemplateCells(def, before, after).size).toBe(0);
  });

  it('names a changed question by its key', () => {
    const beliefs = getFormTemplate('agame-beliefs');
    expect([
      ...changedTemplateCells(beliefs, { empoweringBeliefs: 'a' }, { empoweringBeliefs: 'b' }),
    ]).toEqual(['empoweringBeliefs']);
  });
});
