import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <button type="button" className="confirm-dialog__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="confirm-dialog__panel">
        <h3 id="confirm-dialog-title" className="confirm-dialog__title">
          {title}
        </h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn-outline confirm-dialog__btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn-${variant} confirm-dialog__btn`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
