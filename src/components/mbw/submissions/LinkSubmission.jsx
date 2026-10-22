import { useEffect, useRef, useState } from 'react';
import {
  clearTemplateDraft,
  readTemplateDraft,
  writeTemplateDraft,
} from '../../../utils/templateDrafts';

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function LinkSubmission({
  task,
  submission,
  canSubmit,
  onSubmit,
  submitLabel = '',
  draftKey = '',
  onDraftChange,
}) {
  /* As with a written answer: a draft on this device, or the saved link. */
  const startingLink = () =>
    readTemplateDraft(draftKey)?.fields?.link ?? submission?.linkValue ?? '';
  const [link, setLink] = useState(startingLink);
  const draftTimer = useRef(null);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    setLink(startingLink());
    onDraftChangeRef.current?.(readTemplateDraft(draftKey)?.savedAt || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, submission?.linkValue, draftKey]);

  useEffect(() => () => clearTimeout(draftTimer.current), []);

  const keepDraft = (value) => {
    if (!draftKey) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const at = writeTemplateDraft(draftKey, { link: value });
      if (at) onDraftChangeRef.current?.(at);
    }, 800);
  };

  const saved = submission?.linkValue;

  return (
    <div className="mbw-submission">
      <label htmlFor={`link-${task.id}`}>{task.linkLabel || 'Paste URL'}</label>
      <input
        id={`link-${task.id}`}
        type="url"
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          keepDraft(e.target.value);
        }}
        placeholder="https://linkedin.com/in/…"
        disabled={!canSubmit && saved}
      />
      {saved && (
        <p className="mbw-submission__saved">
          Saved:{' '}
          <a href={saved} target="_blank" rel="noreferrer">
            {saved}
          </a>
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canSubmit || !isValidUrl(link)}
        onClick={() => {
          clearTimeout(draftTimer.current);
          clearTemplateDraft(draftKey);
          onDraftChangeRef.current?.(null);
          onSubmit({ linkValue: link.trim() });
        }}
      >
        {submitLabel || 'Submit link'}
      </button>
    </div>
  );
}
