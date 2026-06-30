import { useState } from 'react';
import { MBW_STORAGE_ENABLED, uploadMbwFile } from '../../../services/mbwService';
import TaskTemplateDownloads from './TaskTemplateDownloads';

export default function FileUpload({ task, submission, canSubmit, userId, onSubmit }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const skipped = submission?.storageSkipped;
  const saved = submission?.fileUrl || (submission?.fileName && !skipped);
  const submitLabel = task.uploadSubmitLabel || 'Submit file';
  const skipLabel = task.uploadSkipLabel || 'Continue without uploading';
  const uploadKind = task.uploadKind || 'file';

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      if (!MBW_STORAGE_ENABLED) {
        await onSubmit({
          fileName: file.name,
          localFallback: true,
          fileSize: file.size,
          fileType: file.type,
        });
        setFile(null);
        return;
      }

      const uploaded = await uploadMbwFile(userId, task.id, file, uploadKind);
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
        fileName: task.uploadSkipLabel ? 'Upload skipped' : 'Resume upload skipped',
      });
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mbw-submission">
      <TaskTemplateDownloads taskId={task.id} task={task} />
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
          <p className="muted">You chose to continue without uploading. You can upload your file later.</p>
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
          Cloud storage is not enabled — your file name is saved and the task completes; re-upload after
          storage is configured to attach the file in the cloud.
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
          {uploading ? 'Uploading…' : submitLabel}
        </button>
        {!saved && !skipped && task.optional && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={uploading}
            onClick={handleSkip}
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
