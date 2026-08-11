import { describe, it, expect } from 'vitest';
import {
  normalizeProgramCode,
  getCourseProgramMeta,
  getProgramCoverSrc,
  getProgramMarketingUrl,
  COURSE_PROGRAM_META,
} from './courseDisplay';

describe('normalizeProgramCode', () => {
  it('upper-cases and strips whitespace', () => {
    expect(normalizeProgramCode(' mbw ')).toBe('MBW');
    expect(normalizeProgramCode('100 BM')).toBe('100BM');
  });

  it('maps the long-form 100 Board Members name', () => {
    expect(normalizeProgramCode('100 Board Members')).toBe('100BM');
    expect(normalizeProgramCode('100BoardMembers')).toBe('100BM');
  });

  it('survives empty and non-string input', () => {
    expect(normalizeProgramCode('')).toBe('');
    expect(normalizeProgramCode(null)).toBe('');
    expect(normalizeProgramCode(undefined)).toBe('');
  });
});

describe('getCourseProgramMeta', () => {
  it('returns the real metadata for each programme', () => {
    expect(getCourseProgramMeta('MBW').duration).toBe('1 year');
    expect(getCourseProgramMeta('LEP').duration).toBe('4 weeks');
    expect(getCourseProgramMeta('100BM').duration).toBe('6 months');
  });

  it('normalises before looking up', () => {
    expect(getCourseProgramMeta('mbw')).toEqual(COURSE_PROGRAM_META.MBW);
    expect(getCourseProgramMeta('100 Board Members')).toEqual(COURSE_PROGRAM_META['100BM']);
  });

  it('falls back to neutral copy rather than undefined for an unknown code', () => {
    const meta = getCourseProgramMeta('XYZ');
    expect(meta.tag).toBe('Program');
    expect(meta.duration).toBe('Self-paced');
    expect(meta.format).toBe('Online');
  });

  it('never returns undefined fields that would render as blank UI', () => {
    for (const code of ['MBW', 'LEP', '100BM', 'UNKNOWN', '']) {
      const meta = getCourseProgramMeta(code);
      expect(meta.tag).toBeTruthy();
      expect(meta.duration).toBeTruthy();
      expect(meta.format).toBeTruthy();
    }
  });
});

describe('getProgramCoverSrc', () => {
  it('returns cover art for known programmes', () => {
    expect(getProgramCoverSrc('MBW')).toBe('/programs/mbw.png');
    expect(getProgramCoverSrc('100BM')).toBe('/programs/100bm.png');
  });

  it('returns an empty string, not undefined, when there is no cover', () => {
    expect(getProgramCoverSrc('XYZ')).toBe('');
  });
});

describe('getProgramMarketingUrl', () => {
  it('links each programme to its public page', () => {
    expect(getProgramMarketingUrl('LEP')).toContain('iamironlady.com');
    expect(getProgramMarketingUrl('100bm')).toContain('100-board-members');
  });

  it('returns null for an unknown programme so callers can hide the link', () => {
    expect(getProgramMarketingUrl('XYZ')).toBeNull();
    expect(getProgramMarketingUrl('')).toBeNull();
  });

  it('only ever points at the Iron Lady domain', () => {
    for (const code of ['LEP', '100BM', 'MBW']) {
      expect(getProgramMarketingUrl(code)).toMatch(/^https:\/\/iamironlady\.com\//);
    }
  });
});
