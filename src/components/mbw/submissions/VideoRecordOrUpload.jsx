import { useRef, useState } from 'react';
import { MBW_STORAGE_ENABLED, uploadMbwFile } from '../../../services/mbwService';

export default function VideoRecordOrUpload({ task, submission, canSubmit, userId, onSubmit }) {
  const [mode, setMode] = useState('record');
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(submission?.videoUrl || null);
  const [blob, setBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const skipped = submission?.storageSkipped;
  const saved = submission?.videoUrl || skipped;

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'video/webm' });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
    } catch {
      alert('Camera access denied. Use upload instead.');
      setMode('upload');
    }
  };

  const stopRecord = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const retake = () => {
    setBlob(null);
    setPreviewUrl(null);
    chunksRef.current = [];
  };

  const saveFinal = async (file) => {
    setUploading(true);
    setError('');
    try {
      if (!MBW_STORAGE_ENABLED) {
        await onSubmit({
          storageSkipped: true,
          fileName: 'Mirror practice saved (upload pending)',
        });
        return;
      }

      const f =
        file ||
        new File([blob], `mirror-${Date.now()}.webm`, { type: 'video/webm' });
      const uploaded = await uploadMbwFile(userId, task.id, f, 'video');
      await onSubmit({
        videoUrl: uploaded.url,
        fileName: uploaded.fileName,
        localFallback: uploaded.localFallback || false,
      });
    } catch (e) {
      setError(e.message || 'Could not save submission');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mbw-submission mbw-video-record">
      {saved && submission?.videoUrl && (
        <div className="mbw-submission__saved">
          <video src={submission.videoUrl} controls className="mbw-video-record__playback" />
        </div>
      )}
      {skipped && (
        <div className="mbw-submission__saved">
          <p className="success-text">Mirror practice saved successfully!</p>
        </div>
      )}

      {!saved && (
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

          {!MBW_STORAGE_ENABLED && (
            <p className="mbw-task__hint muted">
              Cloud storage is not configured yet — your recording is saved on this device and the step
              will complete when you click Save final.
            </p>
          )}

          {mode === 'record' ? (
            <div className="mbw-video-record__panel">
              {!previewUrl ? (
                <>
                  <video ref={videoRef} className="mbw-video-record__live" muted playsInline />
                  {!recording ? (
                    <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={startRecord}>
                      Start recording
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger" onClick={stopRecord}>
                      Stop
                    </button>
                  )}
                </>
              ) : (
                <>
                  <video src={previewUrl} controls className="mbw-video-record__playback" />
                  <div className="mbw-submission__actions">
                    <button type="button" className="btn btn-outline" onClick={retake}>
                      Retake
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canSubmit || uploading}
                      onClick={() => saveFinal()}
                    >
                      {uploading ? 'Saving…' : 'Save final'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mbw-video-record__panel">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) saveFinal(f);
                }}
                disabled={!canSubmit || uploading}
              />
            </div>
          )}
        </>
      )}

      {error && <p className="alert alert-error">{error}</p>}
    </div>
  );
}
