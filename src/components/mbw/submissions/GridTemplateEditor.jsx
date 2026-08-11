import { useEffect, useMemo, useState } from 'react';
import {
  createGridRows,
  getFormTemplate,
  isGridComplete,
} from '../../../data/formTemplates/registry';

export default function GridTemplateEditor({ templateId, task, submission, canSubmit, onSave }) {
  const definition = getFormTemplate(templateId);
  const [rows, setRows] = useState(
    () => submission?.templateData?.rows || createGridRows(definition)
  );
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (
      submission?.templateData?.templateId === templateId &&
      submission?.templateData?.rows?.length
    ) {
      setRows(submission.templateData.rows);
    } else {
      setRows(createGridRows(definition));
    }
    setValidationError('');
  }, [templateId, task.id, submission?.templateData, definition]);

  const complete = useMemo(() => isGridComplete(rows, definition), [rows, definition]);
  const rowLabelKey = definition?.rowKey || 'label';
  const firstColumnHeader =
    templateId === 'super-power' ? 'Row' : templateId === 'theme' ? 'Theme' : 'Item';

  const updateCell = (rowIdx, key, value) => {
    setRows((prev) =>
      prev.map((row, index) => (index === rowIdx ? { ...row, [key]: value } : row))
    );
    if (validationError) setValidationError('');
  };

  const handleSave = async () => {
    if (!complete) {
      setValidationError('Fill every block in the table before submitting.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ templateId, rows });
    } finally {
      setSaving(false);
    }
  };

  if (!definition) return null;

  return (
    <div className="mbw-submission mbw-errc mbw-grid-template">
      <p className="mbw-task__hint">
        {task.description || 'Complete the table below — every block must be filled.'}
      </p>

      <div className="mbw-errc__cards">
        {rows.map((row, rowIdx) => (
          <div key={`${row[rowLabelKey]}-${rowIdx}`} className="mbw-errc-card">
            <p className="mbw-errc-card__task">{row[rowLabelKey] || `Row ${rowIdx + 1}`}</p>
            {definition.columns.map((col) => (
              <label key={col.key} className="mbw-errc-card__field">
                <span>{col.label}</span>
                <textarea
                  rows={3}
                  value={row[col.key] || ''}
                  onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                  placeholder={col.label}
                  required
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="mbw-errc__wrap mbw-errc__wrap--desktop">
        <table className="mbw-errc__table">
          <caption className="sr-only">{task.title}</caption>
          <thead>
            <tr>
              <th className="mbw-errc__th-tasks">{firstColumnHeader}</th>
              {definition.columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={`${row[rowLabelKey]}-${rowIdx}`}>
                <th scope="row" className="mbw-errc__task-label">
                  {row[rowLabelKey] || `Row ${rowIdx + 1}`}
                </th>
                {definition.columns.map((col) => (
                  <td key={col.key}>
                    <textarea
                      rows={4}
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                      placeholder={col.label}
                      aria-label={`${row[rowLabelKey] || `Row ${rowIdx + 1}`} — ${col.label}`}
                      required
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          {saving
            ? 'Saving…'
            : task.uploadSubmitLabel || definition.submitLabel || 'Save submission'}
        </button>
      </div>
    </div>
  );
}
