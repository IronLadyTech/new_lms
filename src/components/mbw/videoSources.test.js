import { describe, it, expect } from 'vitest';
import { youtubeVideoId, isHls } from './WatchGatedVideo';

/**
 * Video source routing.
 *
 * Lessons carry two kinds of link: unlisted YouTube, and HLS served from
 * CloudFront. Picking the wrong player fails silently — the learner sees a dead
 * black frame rather than an error — so both real shapes are pinned here.
 */

const YOUTUBE = 'https://www.youtube.com/watch?v=uo9xA5xiRWY';
const CLOUDFRONT =
  'https://d3jv3ztk062m9h.cloudfront.net/videos/ERRC%20edited/output/ERRC%20edited.m3u8';

describe('routing the sources actually in use', () => {
  it('sends the YouTube link to the embed player', () => {
    expect(youtubeVideoId(YOUTUBE)).toBe('uo9xA5xiRWY');
    expect(isHls(YOUTUBE)).toBe(false);
  });

  it('sends the CloudFront manifest to the HLS player', () => {
    expect(isHls(CLOUDFRONT)).toBe(true);
    expect(youtubeVideoId(CLOUDFRONT)).toBeNull();
  });

  it('copes with the spaces encoded in the CloudFront path', () => {
    // The real path contains "ERRC%20edited" twice; a stricter pattern that
    // assumed a clean path would miss it.
    expect(CLOUDFRONT).toContain('%20');
    expect(isHls(CLOUDFRONT)).toBe(true);
  });
});

describe('isHls', () => {
  it('spots a manifest with or without a query string', () => {
    expect(isHls('https://example.com/a/video.m3u8')).toBe(true);
    expect(isHls('https://example.com/a/video.m3u8?token=abc')).toBe(true);
  });

  it('does not treat an mp4 as a manifest', () => {
    expect(isHls('https://example.com/clip.mp4')).toBe(false);
    expect(isHls('')).toBe(false);
    expect(isHls(null)).toBe(false);
  });
});

describe('youtubeVideoId', () => {
  it('reads an id from the usual YouTube shapes', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=uo9xA5xiRWY')).toBe('uo9xA5xiRWY');
    expect(youtubeVideoId('https://youtu.be/uo9xA5xiRWY')).toBe('uo9xA5xiRWY');
    expect(youtubeVideoId('https://www.youtube.com/embed/uo9xA5xiRWY')).toBe('uo9xA5xiRWY');
  });

  it('never claims a manifest, even one carrying a v= parameter', () => {
    /*
     * The `v=` alternative matches anywhere in the string, so a signed manifest
     * URL would be read as a YouTube id and sent to the wrong player. This is
     * the case the HLS-first check exists for.
     */
    expect(youtubeVideoId('https://d3jv3ztk062m9h.cloudfront.net/a/out.m3u8?v=2')).toBeNull();
    expect(youtubeVideoId(CLOUDFRONT)).toBeNull();
  });

  it('returns null for a plain file URL and for nothing', () => {
    expect(youtubeVideoId('https://example.com/clip.mp4')).toBeNull();
    expect(youtubeVideoId('')).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });
});
