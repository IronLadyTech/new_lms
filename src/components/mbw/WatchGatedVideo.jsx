import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
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

function NativeVideoPlayer({ videoUrl, videoRef, onTimeUpdate, onEnded }) {
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
      muted
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
    />
  );
}

function HlsVideoPlayer({ videoUrl, videoRef, onTimeUpdate, onEnded }) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let hls;

    const attach = () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
        return;
      }

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else {
        video.src = videoUrl;
      }
    };

    attach();

    return () => {
      hls?.destroy();
    };
  }, [videoRef, videoUrl]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      muted
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
    />
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
}) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(() => watchPercent >= threshold);
  const [youtubeStarted, setYoutubeStarted] = useState(false);

  useEffect(() => {
    if (watchPercent >= threshold) setStarted(true);
  }, [watchPercent, threshold]);

  useEffect(() => {
    setYoutubeStarted(false);
  }, [videoUrl, taskId]);

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
    const pct = Math.min(100, Math.round(watchPercent * 100));
    const ytId = youtubeVideoId(videoUrl);
    const thumb = youtubeThumbnail(ytId);

    return (
      <div className="mbw-video mbw-video--embed lesson-video">
        <header className="lesson-video__head">
          <Video size={18} aria-hidden />
          <h3 className="lesson-video__title">{title}</h3>
          <span className="lesson-video__pct">{pct}% watched</span>
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
          Watch the full video to unlock submission. If the player does not start, open it in YouTube.
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
            disabled={watchPercent >= threshold}
            onClick={() => {
              onProgress?.(1);
              onComplete?.();
            }}
          >
            {watchPercent >= threshold ? 'Video watched' : 'I finished watching'}
          </button>
        </div>
      </div>
    );
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v?.duration) return;
    const pct = v.currentTime / v.duration;
    onProgress?.(pct);
    if (pct >= threshold) onComplete?.();
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
            onEnded={() => {
              onProgress?.(1);
              onComplete?.();
            }}
          />
        )}
      </div>
      <p className="muted mbw-video__hint">
        Watch the full video to unlock submission. Progress is tracked automatically.
      </p>
      <div className="mbw-video__progress">
        <div className="mbw-video__bar" style={{ width: `${Math.min(100, watchPercent * 100)}%` }} />
        <span className="muted">{Math.round(watchPercent * 100)}% watched</span>
      </div>
    </div>
  );
}
