import { useState } from 'react';
import { MBW_STORAGE_ENABLED, uploadMbwFile } from '../../../services/mbwService';

export default function FileUpload({ task, submission, canSubmit, userId, onSubmit }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const skipped = submission?.storageSkipped;
  const saved = submission?.fileUrl || (submission?.fileName && !skipped);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadMbwFile(userId, task.id, file, 'resume');
      await onSubmit({
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
        filePath: uploaded.path,
        localFallback: uploaded.localFallback || false,
      });
      setFile(null);
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = async () => {
    setUploading(true);
    setError('');
    try {
      await onSubmit({
        storageSkipped: true,
        fileName: 'Resume upload skipped',
      });
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mbw-submission">
      {saved && (
        <div className="mbw-submission__saved">
          <strong>Submitted file:</strong>{' '}
          {submission.fileUrl ? (
            <a href={submission.fileUrl} target="_blank" rel="noreferrer">
              {submission.fileName || 'Download'}
            </a>
          ) : (
            <span>{submission.fileName} (saved locally — re-upload when online)</span>
          )}
        </div>
      )}
      {skipped && (
        <div className="mbw-submission__saved">
          <p className="muted">You chose to continue without uploading. You can upload your resume later.</p>
        </div>
      )}
      <input
        type="file"
        accept={task.accept || '.pdf,.doc,.docx'}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={!canSubmit && saved}
      />
      {!MBW_STORAGE_ENABLED && (
        <p className="mbw-task__hint muted">
          Cloud storage is not configured yet — file pick and submit still work on this device.
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <div className="mbw-submission__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit || !file || uploading}
          onClick={handleUpload}
        >
          {uploading ? 'Uploading…' : 'Submit resume'}
        </button>
        {!saved && !skipped && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={uploading}
            onClick={handleSkip}
          >
            Continue without uploading
          </button>
        )}
      </div>
    </div>
  );
}
