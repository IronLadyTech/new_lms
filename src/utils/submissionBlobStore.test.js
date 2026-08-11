// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  submissionBlobKey,
  saveSubmissionBlob,
  getSubmissionBlob,
  deleteSubmissionBlob,
} from './submissionBlobStore';

/**
 * The local hold for a recording or upload that has not reached the cloud yet.
 * Losing a blob here loses a learner's work outright, so the guards against
 * bad keys matter more than the happy path.
 *
 * jsdom has no IndexedDB, so the calls fall into their error path. That is
 * exactly the browser-with-storage-blocked case, and they must not throw
 * synchronously or corrupt anything.
 */

describe('submissionBlobKey', () => {
  it('namespaces by programme, learner, and task', () => {
    expect(submissionBlobKey('mbw', 'u1', 't1')).toBe('mbw:u1:t1');
  });

  it('keeps two learners on the same task apart', () => {
    expect(submissionBlobKey('mbw', 'u1', 't1')).not.toBe(submissionBlobKey('mbw', 'u2', 't1'));
  });

  it('keeps two tasks for the same learner apart', () => {
    expect(submissionBlobKey('mbw', 'u1', 't1')).not.toBe(submissionBlobKey('mbw', 'u1', 't2'));
  });

  it('keeps the same task id in different programmes apart', () => {
    expect(submissionBlobKey('mbw', 'u1', 't1')).not.toBe(submissionBlobKey('100bm', 'u1', 't1'));
  });

  it('is stable for the same inputs', () => {
    expect(submissionBlobKey('mbw', 'u1', 't1')).toBe(submissionBlobKey('mbw', 'u1', 't1'));
  });
});

describe('guards against missing arguments', () => {
  it('saving without a key or blob is a no-op, not an error', async () => {
    await expect(saveSubmissionBlob('', new Blob(['x']))).resolves.toBeUndefined();
    await expect(saveSubmissionBlob('k', null)).resolves.toBeUndefined();
  });

  it('reading without a key returns null', async () => {
    await expect(getSubmissionBlob('')).resolves.toBeNull();
    await expect(getSubmissionBlob(null)).resolves.toBeNull();
  });

  it('deleting without a key is a no-op', async () => {
    await expect(deleteSubmissionBlob('')).resolves.toBeUndefined();
  });
});

describe('when IndexedDB is unavailable', () => {
  it('rejects rather than hanging, so callers can fall back', async () => {
    // The submission flow catches this and keeps the learner's work in memory
    // rather than reporting a false save.
    await expect(getSubmissionBlob('mbw:u1:t1')).rejects.toThrow(/IndexedDB unavailable/);
  });
});
