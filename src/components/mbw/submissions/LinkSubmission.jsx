import { useState } from 'react';

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function LinkSubmission({ task, submission, canSubmit, onSubmit }) {
  const [link, setLink] = useState(submission?.linkValue || '');
  const saved = submission?.linkValue;

  return (
    <div className="mbw-submission">
      <label htmlFor={`link-${task.id}`}>{task.linkLabel || 'Paste URL'}</label>
      <input
        id={`link-${task.id}`}
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
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
        onClick={() => onSubmit({ linkValue: link.trim() })}
      >
        Submit link
      </button>
    </div>
  );
}
