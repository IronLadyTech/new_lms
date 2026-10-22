import { useRef, useState } from 'react';
import { saveSubmissionBlob, submissionBlobKey } from '../../utils/submissionBlobStore';
import { getSubmissionProgramConfig } from './submissionProgramConfig';
import TaskTemplateDownloads from './TaskTemplateDownloads';

/*
 * Documents had no ceiling at all — only video did — so nothing stopped a
 * 500MB "resume" from being uploaded and paid for. 15MB is generous for a CV,
 * an assignment or a survey report, and the Storage rules enforce the same
 * number: a check here alone only catches the honest mistake.
 */
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

function readableSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  task,
  submission,
  canSubmit,
  userId,
  onSubmit,
  program = 'mbw',
  submitLabel: submitLabelOverride = '',
}) {
  const { storageEnabled, uploadFile } = getSubmissionProgramConfig(program);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const uploadAbortRef = useRef(null);

  const skipped = submission?.storageSkipped;
  const saved = submission?.fileUrl || (submission?.fileName && !skipped);
  const submitLabel = submitLabelOverride || task.uploadSubmitLabel || 'Submit file';
  const skipLabel = task.uploadSkipLabel || 'Continue without uploading';
  const uploadKind = task.uploadKind || 'file';

  const chooseFile = (picked) => {
    setError('');
    if (picked && picked.size > MAX_DOCUMENT_BYTES) {
      // Says the limit and the actual size, so the learner knows how far over
      // they are rather than just that something is wrong.
      setError(
        `That file is ${readableSize(picked.size)}. The limit is ${readableSize(
          MAX_DOCUMENT_BYTES
        )} — please upload a smaller version.`
      );
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(`That file is over the ${readableSize(MAX_DOCUMENT_BYTES)} limit.`);
      return;
    }
    setUploading(true);
    setUploadProgress(null);
    setError('');
    uploadAbortRef.current = new AbortController();
    try {
      if (!storageEnabled) {
        await saveSubmissionBlob(submissionBlobKey(program, userId, task.id), file, {
          kind: 'file',
          fileName: file.name,
          fileType: file.type,
        }).catch(() => {});
        await onSubmit({
          fileName: file.name,
          localFallback: true,
          fileSize: file.size,
          fileType: file.type,
          hasLocalRecording: true,
          storageSkipped: true,
        });
        setFile(null);
        return;
      }

      const uploaded = await uploadFile(userId, task.id, file, uploadKind, {
        onProgress: setUploadProgress,
        signal: uploadAbortRef.current.signal,
      });
      if (!uploaded.url) {
        await saveSubmissionBlob(submissionBlobKey(program, userId, task.id), file, {
          kind: 'file',
          fileName: file.name,
          fileType: file.type,
        }).catch(() => {});
      }
      await onSubmit({
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
        filePath: uploaded.path,
        localFallback: false,
        storageSkipped: false,
        hasLocalRecording: false,
        fileType: file.type,
      });
      setFile(null);
    } catch (e) {
      if (e?.name === 'AbortError') {
        setError('Upload cancelled.');
      } else {
        setError(e.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      uploadAbortRef.current = null;
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
      <TaskTemplateDownloads taskId={task.id} task={task} program={program} />
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
          <p className="muted">
            You chose to continue without uploading. You can upload your file later.
          </p>
        </div>
      )}
      <input
        type="file"
        accept={task.accept || '.pdf,.doc,.docx'}
        onChange={(e) => chooseFile(e.target.files?.[0] || null)}
        disabled={!canSubmit && saved}
      />
      {/* Stated before they pick, not only after a rejection. */}
      <p className="mbw-task__hint muted">
        {(task.accept || '.pdf,.doc,.docx').replace(/\./g, '').toUpperCase().replace(/,/g, ', ')}
        {' · up to '}
        {readableSize(MAX_DOCUMENT_BYTES)}
      </p>
      {!storageEnabled && (
        <p className="mbw-task__hint muted">
          Cloud storage is not enabled — your file name is saved and the task completes; re-upload
          after storage is configured to attach the file in the cloud.
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      {uploading && uploadProgress != null && (
        <div className="mbw-upload-progress" role="status" aria-live="polite">
          <div className="mbw-upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
          <span className="mbw-upload-progress__label">Uploading… {uploadProgress}%</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => uploadAbortRef.current?.abort()}
          >
            Cancel upload
          </button>
        </div>
      )}
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
