import { describe, it, expect } from 'vitest';
import { getSubmissionMediaUrls, hasCloudMedia, needsCloudUploadRetry } from './submissionMedia';
import { TASK_TYPES } from '../services/mbwService';

/**
 * Media fields accumulated several spellings over time (videoUrl, videoURL,
 * recordingUrl, a typed fileUrl). Resolving them wrongly either hides a
 * learner's submitted video or offers to re-record work already uploaded.
 */

describe('getSubmissionMediaUrls', () => {
  it('reads each historical video field name', () => {
    expect(getSubmissionMediaUrls({ videoUrl: 'a' }).videoUrl).toBe('a');
    expect(getSubmissionMediaUrls({ recordingUrl: 'b' }).videoUrl).toBe('b');
    expect(getSubmissionMediaUrls({ videoURL: 'c' }).videoUrl).toBe('c');
  });

  it('treats a video-typed fileUrl as the video', () => {
    const urls = getSubmissionMediaUrls({ fileUrl: 'v', fileType: 'video/mp4' });
    expect(urls.videoUrl).toBe('v');
    expect(urls.fileUrl).toBeNull(); // not double-counted as an attachment
  });

  it('treats an audio-typed fileUrl as audio', () => {
    const urls = getSubmissionMediaUrls({ fileUrl: 'a', fileType: 'audio/mpeg' });
    expect(urls.audioUrl).toBe('a');
    expect(urls.fileUrl).toBeNull();
  });

  it('keeps a document as a plain attachment', () => {
    const urls = getSubmissionMediaUrls({ fileUrl: 'doc.pdf', fileType: 'application/pdf' });
    expect(urls.fileUrl).toBe('doc.pdf');
    expect(urls.videoUrl).toBeNull();
    expect(urls.audioUrl).toBeNull();
  });

  it('returns all-null for an empty submission instead of throwing', () => {
    expect(getSubmissionMediaUrls(null)).toEqual({ videoUrl: null, audioUrl: null, fileUrl: null });
    expect(getSubmissionMediaUrls({})).toEqual({ videoUrl: null, audioUrl: null, fileUrl: null });
  });

  it('survives a non-string fileType', () => {
    expect(() => getSubmissionMediaUrls({ fileUrl: 'x', fileType: 123 })).not.toThrow();
  });
});

describe('hasCloudMedia', () => {
  it('is true when anything reached the cloud', () => {
    expect(hasCloudMedia({ videoUrl: 'v' })).toBe(true);
    expect(hasCloudMedia({ fileUrl: 'f', fileType: 'application/pdf' })).toBe(true);
  });

  it('is false for text-only or empty submissions', () => {
    expect(hasCloudMedia({ textValue: 'my answer' })).toBe(false);
    expect(hasCloudMedia(null)).toBe(false);
  });
});

describe('needsCloudUploadRetry', () => {
  const videoTask = { type: TASK_TYPES.VIDEO_RECORD };
  const fileTask = { type: TASK_TYPES.FILE_UPLOAD };

  it('offers a retry when the upload was skipped and nothing reached the cloud', () => {
    expect(needsCloudUploadRetry(videoTask, { storageSkipped: true })).toBe(true);
    expect(needsCloudUploadRetry(fileTask, { storageSkipped: true })).toBe(true);
    expect(needsCloudUploadRetry(videoTask, { hasLocalRecording: true })).toBe(true);
  });

  it('does not nag once the media is safely uploaded', () => {
    expect(needsCloudUploadRetry(videoTask, { storageSkipped: true, videoUrl: 'v' })).toBe(false);
    expect(
      needsCloudUploadRetry(fileTask, {
        storageSkipped: true,
        fileUrl: 'f',
        fileType: 'application/pdf',
      })
    ).toBe(false);
  });

  it('stays quiet for a normal submission', () => {
    expect(needsCloudUploadRetry(videoTask, { videoUrl: 'v' })).toBe(false);
    expect(needsCloudUploadRetry(videoTask, {})).toBe(false);
  });

  it('does not apply to task types without uploads', () => {
    expect(needsCloudUploadRetry({ type: TASK_TYPES.WATCH_ONLY }, { storageSkipped: true })).toBe(
      false
    );
  });

  it('handles missing task or submission', () => {
    expect(needsCloudUploadRetry(null, { storageSkipped: true })).toBe(false);
    expect(needsCloudUploadRetry(videoTask, null)).toBe(false);
  });
});
