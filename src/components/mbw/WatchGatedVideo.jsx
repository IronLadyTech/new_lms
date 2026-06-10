import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

function isYouTube(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

function youtubeEmbed(url) {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1` : url;
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
  const [started, setStarted] = useState(false);

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

  return (
    <div className="mbw-video">
      {!started ? (
        <button type="button" className="mbw-video__poster" onClick={() => setStarted(true)}>
          <Play size={48} />
          <span>Play video</span>
        </button>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            onProgress?.(1);
            onComplete?.();
          }}
        />
      )}
      <div className="mbw-video__progress">
        <div className="mbw-video__bar" style={{ width: `${Math.min(100, watchPercent * 100)}%` }} />
        <span className="muted">{Math.round(watchPercent * 100)}% watched</span>
      </div>
    </div>
  );
}
