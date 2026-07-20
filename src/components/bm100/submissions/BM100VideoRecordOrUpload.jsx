import { useEffect, useRef, useState } from 'react';
import { BM100_STORAGE_ENABLED, uploadBm100File } from '../../../services/bm100Service';
import BM100TaskTemplateDownloads from './BM100TaskTemplateDownloads';

function pickRecorderMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export default function BM100VideoRecordOrUpload({ task, submission, canSubmit, userId, onSubmit }) {
  const [mode, setMode] = useState('record');
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [rerecord, setRerecord] = useState(false);
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const previewUrlRef = useRef(null);

  const cloudUrl = submission?.videoUrl || null;
  const skipped = Boolean(submission?.storageSkipped);
  const previouslySubmitted = Boolean(cloudUrl || skipped);
  const showRecorder = rerecord || !previouslySubmitted;
  const playbackUrl = cloudUrl || previewUrl;
  const showPreview = Boolean(playbackUrl) && (Boolean(blob) || (previouslySubmitted && !rerecord));

  const revokePreview = () => {
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
  };

  const setPreviewFromBlob = (b) => {
    revokePreview();
    const url = URL.createObjectURL(b);
    previewUrlRef.current = url;
    setBlob(b);
    setPreviewUrl(url);
  };

  useEffect(() => {
    if (submission?.videoUrl && !rerecord) {
      setPreviewUrl(submission.videoUrl);
      previewUrlRef.current = submission.videoUrl;
    }
  }, [submission?.videoUrl, rerecord]);

  useEffect(
    () => () => {
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    []
  );

  const stopCamera = () => {
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecordAgain = () => {
    stopCamera();
    revokePreview();
    setBlob(null);
    setPreviewUrl(null);
    setError('');
    setRecording(false);
    chunksRef.current = [];
    setMode('record');
    setRerecord(true);
  };

  const startRecord = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      chunksRef.current = [];
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopCamera();
        const type = recorder.mimeType || mimeType || 'video/webm';
        const b = new Blob(chunksRef.current, { type });
        if (!b.size) {
          setError('Recording was empty. Please try again or upload a file.');
          setRecording(false);
          return;
        }
        setPreviewFromBlob(b);
        setRecording(false);
      };

      recorder.onerror = () => {
        setError('Recording failed. Please try again or upload a file.');
        stopCamera();
        setRecording(false);
      };

      recorder.start(250);
      setRecording(true);
    } catch {
      setError('Camera access denied. Use Upload file instead.');
      setMode('upload');
    }
  };

  const stopRecord = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      return;
    }
    try {
      if (recorder.state === 'recording') recorder.requestData();
    } catch {
      /* ignore */
    }
    recorder.stop();
  };

  const retake = () => {
    stopCamera();
    revokePreview();
    setBlob(null);
    setPreviewUrl(null);
    setError('');
    chunksRef.current = [];
  };

  const saveFinal = async (file) => {
    setUploading(true);
    setError('');
    try {
      const sourceBlob = file || blob;
      if (!sourceBlob) {
        setError('No recording to save. Record or upload a file first.');
        return;
      }

      if (file) {
        setPreviewFromBlob(file);
      }

      if (!BM100_STORAGE_ENABLED) {
        await onSubmit({
          storageSkipped: true,
          fileName: file?.name || `recording-${Date.now()}.webm`,
          fileType: sourceBlob.type || 'video/webm',
          fileSize: sourceBlob.size,
          hasLocalRecording: true,
        });
        setRerecord(false);
        return;
      }

      const f =
        file ||
        new File([blob], `bm100-${Date.now()}.webm`, {
          type: blob.type || 'video/webm',
        });
      const uploaded = await uploadBm100File(userId, task.id, f, task.uploadKind || 'video');
      await onSubmit({
        videoUrl: uploaded.url,
        fileName: uploaded.fileName,
        localFallback: uploaded.localFallback || false,
        storageSkipped: !uploaded.url,
        hasLocalRecording: !uploaded.url,
      });

      if (uploaded.url) {
        revokePreview();
        setPreviewUrl(uploaded.url);
        previewUrlRef.current = uploaded.url;
      }
      setRerecord(false);
    } catch (e) {
      setError(e.message || 'Could not save submission');
    } finally {
      setUploading(false);
    }
  };

  const allowSave = canSubmit || rerecord || previouslySubmitted;

  return (
    <div className="mbw-submission mbw-video-record">
      <BM100TaskTemplateDownloads taskId={task.id} task={task} />

      {showPreview && (
        <div className="mbw-submission__saved">
          <video
            key={playbackUrl}
            src={playbackUrl}
            controls
            playsInline
            className="mbw-video-record__playback"
          />
          {skipped && !cloudUrl && !rerecord && (
            <p className="muted mbw-task__hint">
              Recording saved on this device. Cloud playback will be available after storage is enabled.
            </p>
          )}
        </div>
      )}

      {previouslySubmitted && !rerecord && !playbackUrl && (
        <div className="mbw-submission__saved">
          <p className="success-text">Recording submitted successfully.</p>
          <p className="muted mbw-task__hint">
            Playback is unavailable because the file was not uploaded to cloud storage. Re-record if you
            need to review it here.
          </p>
          <button type="button" className="btn btn-outline btn-sm" onClick={startRecordAgain}>
            Record again
          </button>
        </div>
      )}

      {previouslySubmitted && !rerecord && playbackUrl && (
        <div className="mbw-submission__actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={startRecordAgain}>
            Record again
          </button>
        </div>
      )}

      {showRecorder && (
        <>
          <div className="mbw-video-record__tabs">
            <button
              type="button"
              className={mode === 'record' ? 'active' : ''}
              onClick={() => setMode('record')}
            >
              Record in LMS
            </button>
            <button
              type="button"
              className={mode === 'upload' ? 'active' : ''}
              onClick={() => setMode('upload')}
            >
              Upload file
            </button>
          </div>

          {!BM100_STORAGE_ENABLED && (
            <p className="mbw-task__hint muted">
              Cloud storage is not enabled yet — you can still record, preview, and complete this step.
              The video stays on this device until storage is configured.
            </p>
          )}

          {mode === 'record' ? (
            <div className="mbw-video-record__panel">
              {!previewUrl ? (
                <>
                  <video
                    ref={videoRef}
                    className="mbw-video-record__live"
                    muted
                    playsInline
                    autoPlay
                  />
                  {!recording ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!allowSave}
                      onClick={startRecord}
                    >
                      Start recording
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger" onClick={stopRecord}>
                      Stop
                    </button>
                  )}
                </>
              ) : (
                <div className="mbw-submission__actions">
                  <button type="button" className="btn btn-outline" onClick={retake} disabled={uploading}>
                    Retake
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!allowSave || uploading || !blob}
                    onClick={() => saveFinal()}
                  >
                    {uploading ? 'Saving…' : 'Save final'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mbw-video-record__panel">
              <input
                type="file"
                accept={task.accept || 'video/*,audio/*'}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) saveFinal(f);
                }}
                disabled={!allowSave || uploading}
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
