import { useState } from 'react';

export default function TextSubmission({ task, submission, canSubmit, onSubmit, readOnly }) {
  const [text, setText] = useState(submission?.textValue || '');

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
      <label htmlFor={`text-${task.id}`}>{task.description}</label>
      <textarea
        id={`text-${task.id}`}
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={task.placeholder || 'Type your response…'}
        disabled={!canSubmit && !saved}
      />
      {saved && (
        <p className="muted mbw-submission__saved-note">Previously saved — edit and re-submit to update.</p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canSubmit || !text.trim()}
        onClick={() => onSubmit({ textValue: text.trim() })}
      >
        Save submission
      </button>
    </div>
  );
}
