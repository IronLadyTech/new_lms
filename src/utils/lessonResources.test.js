import { describe, it, expect } from 'vitest';
import { actionLinks, fileResources, isFileResource } from './lessonResources';

/**
 * A lesson's links split two ways: files to keep beside the lesson, and places
 * the learner has to go.
 */

const task = {
  resourceLinks: [
    { label: 'CoDeSeF Guidelines and Template', url: '/templates/lep/codesef-guidelines-template.pdf' },
    { label: 'VIA Character Survey', url: 'https://www.viacharacter.org/survey' },
    { label: 'Roadmap workbook', url: '/templates/lep/roadmap.docx?v=2' },
    { label: 'Nothing', url: '' },
  ],
};

describe('telling a file from a place to go', () => {
  it('counts documents as files, query string and all', () => {
    expect(isFileResource({ url: '/a/b.pdf' })).toBe(true);
    expect(isFileResource({ url: '/a/b.docx?v=2' })).toBe(true);
    expect(isFileResource({ url: 'https://example.com/survey' })).toBe(false);
    expect(isFileResource(null)).toBe(false);
  });

  it('keeps the lesson’s files in order and drops empty links', () => {
    expect(fileResources(task).map((l) => l.label)).toEqual([
      'CoDeSeF Guidelines and Template',
      'Roadmap workbook',
    ]);
  });

  it('leaves what the learner must go and do', () => {
    expect(actionLinks(task).map((l) => l.label)).toEqual(['VIA Character Survey']);
  });

  it('is quiet about a task with no links', () => {
    expect(fileResources({})).toEqual([]);
    expect(actionLinks(undefined)).toEqual([]);
  });
});
