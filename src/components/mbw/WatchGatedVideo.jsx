import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play } from 'lucide-react';

function isYouTube(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

function isHls(url) {
  return /\.m3u8(\?|$)/i.test(url || '');
}

function youtubeEmbed(url) {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1` : url;
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

  useEffect(() => {
    if (watchPercent >= threshold) setStarted(true);
  }, [watchPercent, threshold]);

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
    return (
      <div className="mbw-video mbw-video--embed">
        <iframe
          title={title}
          src={youtubeEmbed(videoUrl)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <p className="muted mbw-video__hint">
          Watch the full video to unlock submission. If tracking doesn&apos;t update, use the button below.
        </p>
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

  return (
    <div className="mbw-video mbw-video--hosted">
      <div className="mbw-video__frame">
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
