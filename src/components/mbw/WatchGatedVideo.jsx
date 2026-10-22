import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize, Play, Video } from 'lucide-react';

function isYouTube(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

export function isHls(url) {
  return /\.m3u8(\?|$)/i.test(url || '');
}

export function youtubeVideoId(url) {
  /*
   * A manifest is never a YouTube video, and this pattern matches `v=` anywhere
   * in a string — so an HLS URL carrying any `v=` query parameter (a signed
   * CloudFront link, say) would otherwise be read as a YouTube id and handed to
   * the wrong player. Checking HLS first closes that off.
   */
  if (!url || isHls(url)) return null;
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]+)/);
  return match ? match[1] : null;
}

function youtubeEmbed(url, { autoplay = false } = {}) {
  const id = youtubeVideoId(url);
  if (!id) return url;

  const params = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
  });

  if (autoplay) params.set('autoplay', '1');
  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function youtubeThumbnail(id) {
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/*
 * Keeps the file inside the LMS as far as the browser allows.
 *
 * `nodownload` removes the download item from the native menu,
 * `noremoteplayback` stops it being cast to another device,
 * `disablePictureInPicture` stops it being popped into a floating window
 * outside the page, and the context-menu handler removes "Save video as...".
 *
 * This is deterrence, not protection: the file is still fetched over the
 * network and anyone who opens devtools can read its URL. Real protection needs
 * short-lived signed URLs from Storage, which is a backend change.
 */
const GUARD_PROPS = {
  controlsList: 'nodownload noremoteplayback',
  disablePictureInPicture: true,
  onContextMenu: (e) => e.preventDefault(),
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * The controls under a player: playback speed, and fullscreen/rotate.
 *
 * One row, not two, and one speed control rather than five buttons. Five pills
 * plus a labelled button took more vertical space on a phone than the "I
 * finished watching" action they sat above, and read as heavier than the video
 * itself.
 *
 * Speed is a native <select> on purpose: on a phone it opens the OS picker,
 * which is bigger, familiar and accessible for free — a custom menu here would
 * be more code for a worse result.
 *
 * @param {object} props
 * @param {(rate: number) => void} props.onSpeed
 * @param {() => void} props.onFullscreen
 */
function PlayerControls({ onSpeed, onFullscreen }) {
  const [speed, setSpeed] = useState(1);

  const change = (e) => {
    const rate = Number(e.target.value);
    setSpeed(rate);
    onSpeed(rate);
  };

  return (
    <div className="mbw-video__controls">
      <label className="mbw-video__speed">
        <span className="sr-only">Playback speed</span>
        <select value={speed} onChange={change}>
          {SPEEDS.map((rate) => (
            <option key={rate} value={rate}>
              {rate}&times;
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="mbw-video__fs"
        onClick={onFullscreen}
        aria-label="Play fullscreen"
        title="Fullscreen"
      >
        <Maximize size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Fullscreen, then landscape where the browser allows it.
 *
 * Orientation can only be locked while fullscreen, and iOS Safari does not
 * implement the lock at all — so fullscreen is requested first and the lock
 * attempted after, with its rejection swallowed. On a device that refuses, the
 * learner still gets fullscreen and can turn the phone themselves.
 */
async function goFullscreen(el) {
  if (!el) return;
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    }
    await window.screen?.orientation?.lock?.('landscape');
  } catch {
    /* Locking is best-effort; fullscreen alone is a usable outcome. */
  }
}

/** Controls for a hosted video, driving the element through its ref. */
function VideoExtras({ videoRef }) {
  return (
    <PlayerControls
      onSpeed={(rate) => {
        const v = videoRef.current;
        if (v) v.playbackRate = rate;
      }}
      onFullscreen={() => goFullscreen(videoRef.current)}
    />
  );
}

/**
 * Controls for the YouTube embed.
 *
 * The embed already sets `enablejsapi=1`, so it accepts commands by postMessage
 * and there is no need to pull in YouTube's IFrame API script for one control.
 * Messages are addressed to the nocookie origin the iframe is served from
 * rather than "*".
 */
function YouTubeExtras({ frameRef }) {
  return (
    <PlayerControls
      onSpeed={(rate) => {
        const win = frameRef.current?.contentWindow;
        if (!win) return;
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [rate] }),
          'https://www.youtube-nocookie.com'
        );
      }}
      onFullscreen={() => goFullscreen(frameRef.current)}
    />
  );
}

function NativeVideoPlayer({
  videoUrl,
  videoRef,
  onTimeUpdate,
  onEnded,
  captionsUrl,
  captionsLabel,
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHls(videoUrl)) return undefined;

    video.src = videoUrl;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [videoRef, videoUrl]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      crossOrigin={captionsUrl ? 'anonymous' : undefined}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      {...GUARD_PROPS}
    >
      {captionsUrl ? (
        <track
          kind="captions"
          srcLang="en"
          label={captionsLabel || 'English'}
          src={captionsUrl}
          default
        />
      ) : null}
    </video>
  );
}

function HlsVideoPlayer({ videoUrl, videoRef, onTimeUpdate, onEnded, captionsUrl, captionsLabel }) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let hls;
    let cancelled = false;

    // Safari plays HLS natively — only browsers that need the polyfill pay to download it.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoUrl;
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || !videoRef.current) return;
          if (!Hls.isSupported()) {
            video.src = videoUrl;
            return;
          }
          hls = new Hls();
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
        })
        .catch(() => {
          if (!cancelled) video.src = videoUrl;
        });
    }

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [videoRef, videoUrl]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      crossOrigin={captionsUrl ? 'anonymous' : undefined}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      {...GUARD_PROPS}
    >
      {captionsUrl ? (
        <track
          kind="captions"
          srcLang="en"
          label={captionsLabel || 'English'}
          src={captionsUrl}
          default
        />
      ) : null}
    </video>
  );
}

export default function WatchGatedVideo({
  taskId,
  videoUrl,
  title,
  watchPercent = 0,
  onProgress,
  onComplete,
  threshold = 0.9,
  captionsUrl = '',
  captionsLabel = 'English',
}) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const lastProgressEmit = useRef(0);
  const [started, setStarted] = useState(() => watchPercent >= threshold);
  const [youtubeStarted, setYoutubeStarted] = useState(false);

  useEffect(() => {
    if (watchPercent >= threshold) setStarted(true);
  }, [watchPercent, threshold]);

  useEffect(() => {
    setYoutubeStarted(false);
  }, [videoUrl, taskId]);

  const emitProgress = useCallback(
    (pct) => {
      const now = Date.now();
      if (now - lastProgressEmit.current < 1000 && pct < threshold) return;
      lastProgressEmit.current = now;
      onProgress?.(pct);
      if (pct >= threshold) onComplete?.();
    },
    [onProgress, onComplete, threshold]
  );

  if (!videoUrl) {
    return (
      <div className="mbw-video mbw-video--empty">
        <p>Your instructor hasn&apos;t added a video for this task yet.</p>
        <p className="muted mbw-video__empty-hint">
          Contact support if you need access before continuing.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm mbw-video__skip"
          onClick={() => onComplete?.()}
        >
          Continue without video
        </button>
      </div>
    );
  }

  if (isYouTube(videoUrl)) {
    const ytId = youtubeVideoId(videoUrl);
    const thumb = youtubeThumbnail(ytId);
    const youtubeComplete = watchPercent >= threshold;

    return (
      <div className="mbw-video mbw-video--embed lesson-video">
        <header className="lesson-video__head">
          <Video size={18} aria-hidden />
          <h3 className="lesson-video__title">{title}</h3>
          <span className="lesson-video__pct">
            {youtubeComplete ? 'Complete' : 'Confirm when finished'}
          </span>
        </header>
        <div className="mbw-video__frame lesson-video__frame">
          {!youtubeStarted ? (
            <button
              type="button"
              className="mbw-video__poster mbw-video__poster--youtube"
              onClick={() => setYoutubeStarted(true)}
              aria-label={`Play ${title}`}
            >
              {thumb && (
                <img src={thumb} alt="" className="mbw-video__poster-thumb" aria-hidden="true" />
              )}
              <span className="mbw-video__poster-icon" aria-hidden="true">
                <Play size={28} fill="currentColor" strokeWidth={0} />
              </span>
              <span className="mbw-video__poster-label">Tap to play video</span>
            </button>
          ) : (
            <iframe
              ref={frameRef}
              title={title}
              src={youtubeEmbed(videoUrl, { autoplay: true })}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <p className="muted mbw-video__hint">
          YouTube cannot track watch time automatically. When you have finished watching, tap
          &ldquo;I finished watching&rdquo; below to unlock submission.
        </p>
        <YouTubeExtras frameRef={frameRef} />
        {/*
         * "Open in YouTube" used to sit here. It handed the learner the video's
         * public URL and took them out of the LMS to watch it — the opposite of
         * keeping this content inside the product.
         */}
        <div className="mbw-video__embed-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={youtubeComplete}
            onClick={() => {
              onProgress?.(1);
              onComplete?.();
            }}
          >
            {youtubeComplete ? 'Video watched' : 'I finished watching'}
          </button>
        </div>
      </div>
    );
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v?.duration) return;
    emitProgress(v.currentTime / v.duration);
  };

  /* Two sources in use: unlisted YouTube, and HLS served from CloudFront. The
     manifest path also covers any other .m3u8 host. */
  const playbackUrl = videoUrl;
  const VideoPlayer = isHls(playbackUrl) ? HlsVideoPlayer : NativeVideoPlayer;
  const pct = Math.min(100, Math.round(watchPercent * 100));

  return (
    <div className="mbw-video mbw-video--hosted lesson-video">
      <header className="lesson-video__head">
        <Video size={18} aria-hidden />
        <h3 className="lesson-video__title">{title}</h3>
        <span className="lesson-video__pct">{pct}% watched</span>
      </header>
      <div className="mbw-video__frame lesson-video__frame">
        {!started ? (
          <button type="button" className="mbw-video__poster" onClick={() => setStarted(true)}>
            <span className="mbw-video__poster-icon" aria-hidden="true">
              <Play size={28} fill="currentColor" strokeWidth={0} />
            </span>
            <span className="mbw-video__poster-label">{title}</span>
          </button>
        ) : (
          <VideoPlayer
            videoUrl={playbackUrl}
            videoRef={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => emitProgress(1)}
            captionsUrl={captionsUrl}
            captionsLabel={captionsLabel}
          />
        )}
      </div>
      {started ? <VideoExtras videoRef={videoRef} /> : null}
      <p className="muted mbw-video__hint">
        Watch the full video to unlock submission. Progress is tracked automatically and saved as
        you watch.
        {captionsUrl
          ? ' Captions are available via the player controls.'
          : ' Captions are not available for this video yet.'}
      </p>
      <div className="mbw-video__progress">
        <div
          className="mbw-video__bar"
          style={{ width: `${Math.min(100, watchPercent * 100)}%` }}
        />
        <span className="muted">{Math.round(watchPercent * 100)}% watched</span>
      </div>
    </div>
  );
}
