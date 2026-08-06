import { useEffect, useMemo, useState } from 'react';
import {
  createTemplateFields,
  getFormTemplate,
  isTemplateComplete,
} from '../../../data/formTemplates/registry';

function groupFields(fields = []) {
  const groups = [];
  const seen = new Set();
  fields.forEach((field) => {
    const section = field.section || 'Details';
    if (!seen.has(section)) {
      seen.add(section);
      groups.push({ section, fields: fields.filter((item) => (item.section || 'Details') === section) });
    }
  });
  return groups;
}

export default function FormTemplateEditor({ templateId, task, submission, canSubmit, onSave }) {
  const definition = getFormTemplate(templateId);
  const [fields, setFields] = useState(() => ({
    ...createTemplateFields(templateId),
    ...(submission?.templateData?.templateId === templateId ? submission.templateData.fields : {}),
  }));
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setFields({
      ...createTemplateFields(templateId),
      ...(submission?.templateData?.templateId === templateId ? submission.templateData.fields : {}),
    });
    setValidationError('');
  }, [templateId, task.id, submission?.templateData]);

  const complete = useMemo(
    () => isTemplateComplete(templateId, { fields }),
    [templateId, fields]
  );
  const groups = useMemo(() => groupFields(definition?.fields || []), [definition]);

  const updateField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (validationError) setValidationError('');
  };

  const handleSave = async () => {
    if (!complete) {
      setValidationError('Fill every required block before submitting.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ templateId, fields });
    } finally {
      setSaving(false);
    }
  };

  if (!definition) return null;

  const renderField = (field) => {
    const value = fields[field.key] || '';

    if (field.type === 'radio') {
      return (
        <fieldset key={field.key} className="field mbw-form-template__radio-group">
          <legend>{field.label}</legend>
          {field.hint && <p className="mbw-form-template__hint muted">{field.hint}</p>}
          <div className="mbw-form-template__radio-options">
            {(field.options || []).map((option) => (
              <label key={option} className="mbw-form-template__radio">
                <input
                  type="radio"
                  name={`${templateId}-${field.key}`}
                  value={option}
                  checked={value === option}
                  onChange={() => updateField(field.key, option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (field.type === 'textarea') {
      return (
        <label key={field.key} className="field">
          <span>{field.label}</span>
          {field.hint && <span className="mbw-form-template__hint muted">{field.hint}</span>}
          <textarea
            rows={field.rows || 4}
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder || field.label}
            required={field.required !== false}
          />
        </label>
      );
    }

    return (
      <label key={field.key} className="field">
        <span>{field.label}</span>
        {field.hint && <span className="mbw-form-template__hint muted">{field.hint}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => updateField(field.key, e.target.value)}
          placeholder={field.placeholder || field.label}
          required={field.required !== false}
        />
      </label>
    );
  };

  return (
    <div className="mbw-submission mbw-form-template">
      <p className="mbw-task__hint">
        {task.description || 'Complete every block below before submitting.'}
      </p>

      {groups.map((group) => (
        <section key={group.section} className="mbw-form-template__section">
          <h3 className="mbw-form-template__section-title">{group.section}</h3>
          {group.fields.map(renderField)}
        </section>
      ))}

      {validationError && (
        <p className="alert alert-error" role="alert">
          {validationError}
        </p>
      )}

      <div className="mbw-submission__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit || saving || !complete}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : task.uploadSubmitLabel || definition.submitLabel || 'Save submission'}
        </button>
      </div>
    </div>
  );
}
