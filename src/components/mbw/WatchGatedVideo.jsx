import { useEffect, useRef, useState, useCallback } from 'react';
import { ExternalLink, Play, Video } from 'lucide-react';

function isYouTube(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

function isHls(url) {
  return /\.m3u8(\?|$)/i.test(url || '');
}

function youtubeVideoId(url) {
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

function youtubeWatchUrl(url) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
}

function NativeVideoPlayer({ videoUrl, videoRef, onTimeUpdate, onEnded, captionsUrl, captionsLabel }) {
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
    >
      {captionsUrl ? (
        <track kind="captions" srcLang="en" label={captionsLabel || 'English'} src={captionsUrl} default />
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
    >
      {captionsUrl ? (
        <track kind="captions" srcLang="en" label={captionsLabel || 'English'} src={captionsUrl} default />
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
        <p className="muted mbw-video__empty-hint">Contact support if you need access before continuing.</p>
        <button type="button" className="btn btn-outline btn-sm mbw-video__skip" onClick={() => onComplete?.()}>
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
          YouTube cannot track watch time automatically. When you have finished watching, tap &ldquo;I finished
          watching&rdquo; below to unlock submission.
        </p>
        <div className="mbw-video__embed-actions">
          <a
            href={youtubeWatchUrl(videoUrl)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm mbw-video__youtube-link"
          >
            <ExternalLink size={14} aria-hidden />
            Open in YouTube
          </a>
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

  const VideoPlayer = isHls(videoUrl) ? HlsVideoPlayer : NativeVideoPlayer;
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
            videoUrl={videoUrl}
            videoRef={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => emitProgress(1)}
            captionsUrl={captionsUrl}
            captionsLabel={captionsLabel}
          />
        )}
      </div>
      <p className="muted mbw-video__hint">
        Watch the full video to unlock submission. Progress is tracked automatically and saved as you watch.
        {captionsUrl
          ? ' Captions are available via the player controls.'
          : ' Captions are not available for this video yet.'}
      </p>
      <div className="mbw-video__progress">
        <div className="mbw-video__bar" style={{ width: `${Math.min(100, watchPercent * 100)}%` }} />
        <span className="muted">{Math.round(watchPercent * 100)}% watched</span>
      </div>
    </div>
  );
}
