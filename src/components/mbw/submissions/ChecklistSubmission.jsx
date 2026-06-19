import { useState } from 'react';

export default function ChecklistSubmission({ task, submission, canSubmit, onSubmit }) {
  const items = task.checklistItems || [];
  const [checked, setChecked] = useState(submission?.checkedItems || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (item) => {
    if (!canSubmit || saving) return;
    const next = checked.includes(item)
      ? checked.filter((i) => i !== item)
      : [...checked, item];
    setChecked(next);
    setSaving(true);
    setError('');
    try {
      await onSubmit({ checkedItems: next });
    } catch (e) {
      setChecked(checked);
      setError(e.message || 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mbw-submission mbw-checklist">
      <ul className="mbw-checklist__list">
        {items.map((item) => {
          const isChecked = checked.includes(item);
          return (
            <li key={item}>
              <label className={`mbw-checklist__item${isChecked ? ' is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!canSubmit || saving}
                  onChange={() => toggle(item)}
                />
                <span className="mbw-checklist__label">{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="muted mbw-checklist__progress">
        {checked.length}/{items.length} completed
        {items.length > 0 && checked.length === items.length ? ' — well done!' : ''}
      </p>
      {error && <p className="alert alert-error">{error}</p>}
    </div>
  );
}
