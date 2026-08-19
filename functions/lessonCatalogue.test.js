import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import lessonAssets from './lessonAssets.js';

const { LESSON_ASSETS } = lessonAssets;

/**
 * Every id in the media registry must be a lesson that actually exists.
 *
 * A registry keyed on an invented id fails silently: the lesson simply reports
 * no media, which looks exactly like a recording the team has not uploaded yet.
 * That is how the first permanent video was registered under 'mbw-pre-2', an id
 * no lesson has ever had — nothing errored, and the video would never have
 * played for anybody.
 *
 * The catalogues are read from source rather than imported because they are
 * client modules; this file runs in the functions suite.
 */
const idsIn = (path) => {
  const src = fs.readFileSync(path, 'utf8');
  return new Set([...src.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));
};

const MBW_IDS = idsIn('src/services/mbwService.js');
const BM100_IDS = idsIn('src/data/bm100ProgramStructure.js');
const LEP_IDS = new Set();

const KNOWN = {
  mbw: MBW_IDS,
  '100bm': BM100_IDS,
  lep: LEP_IDS,
};

describe('lesson media registry · ids are real', () => {
  it('reads a non-empty MBW catalogue, so the check below means something', () => {
    // Guards the guard: if the regex stopped matching, every id would look
    // invalid and this suite would fail loudly rather than pass vacuously.
    expect(MBW_IDS.size).toBeGreaterThan(50);
  });

  it.each(Object.keys(LESSON_ASSETS))('%s names a lesson that exists', (id) => {
    const asset = LESSON_ASSETS[id];
    const known = KNOWN[asset.program];
    expect(known, `unknown programme ${asset.program}`).toBeTruthy();
    // LEP has no catalogue in the repo yet; skip rather than assert falsely.
    if (known.size === 0) return;
    expect(known.has(id), `${id} is not a lesson in ${asset.program}`).toBe(true);
  });
});
