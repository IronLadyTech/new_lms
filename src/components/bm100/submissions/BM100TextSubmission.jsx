import { useEffect, useRef, useState } from 'react';
import TaskTemplateDownloads from '../../submissions/TaskTemplateDownloads';
import {
  clearTemplateDraft,
  readTemplateDraft,
  writeTemplateDraft,
} from '../../../utils/templateDrafts';

export default function BM100TextSubmission({
  task,
  submission,
  canSubmit,
  onSubmit,
  readOnly,
  submitLabel = '',
  draftKey = '',
  onDraftChange,
}) {
  /*
   * A draft left on this device wins over the saved answer, so an interrupted
   * edit picks up where it stopped. With no draftKey nothing is kept, which is
   * every programme but LEP.
   */
  const startingText = () =>
    readTemplateDraft(draftKey)?.fields?.text ?? submission?.textValue ?? '';
  const [text, setText] = useState(startingText);
  const draftTimer = useRef(null);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    setText(startingText());
    onDraftChangeRef.current?.(readTemplateDraft(draftKey)?.savedAt || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, submission?.textValue, draftKey]);

  useEffect(() => () => clearTimeout(draftTimer.current), []);

  const keepDraft = (value) => {
    if (!draftKey) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const at = writeTemplateDraft(draftKey, { text: value });
      if (at) onDraftChangeRef.current?.(at);
    }, 800);
  };

  const saveDraftNow = () => {
    clearTimeout(draftTimer.current);
    const at = writeTemplateDraft(draftKey, { text });
    if (at) onDraftChangeRef.current?.(at);
  };

  const clearDraft = () => {
    clearTimeout(draftTimer.current);
    clearTemplateDraft(draftKey);
    onDraftChangeRef.current?.(null);
  };

  const saved = submission?.textValue;

  if (readOnly && saved) {
    return (
      <div className="mbw-submission mbw-submission--saved">
        <h3>Your submission</h3>
        <div className="mbw-submission__body">{saved}</div>
      </div>
    );
  }

  return (
    <div className="mbw-submission">
      <TaskTemplateDownloads taskId={task.id} task={task} program="100bm" />
      <label htmlFor={`text-${task.id}`}>Your response</label>
      <textarea
        id={`text-${task.id}`}
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          keepDraft(e.target.value);
        }}
        placeholder={task.placeholder || 'Type your response…'}
        disabled={!canSubmit && !saved}
      />
      {saved && (
        <p className="muted mbw-submission__saved-note">
          Previously saved — edit and re-submit to update.
        </p>
      )}
      <div className="mbw-submission__actions">
        {draftKey && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={!text.trim()}
            onClick={saveDraftNow}
          >
            Save draft
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit || !text.trim()}
          onClick={() => {
            clearDraft();
            onSubmit({ textValue: text.trim() });
          }}
        >
          {submitLabel || 'Save submission'}
        </button>
      </div>
    </div>
  );
}
