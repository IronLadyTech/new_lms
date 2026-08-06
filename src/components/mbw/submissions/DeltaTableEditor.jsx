import { useEffect, useMemo, useState } from 'react';
import {
  DELTA_COLUMNS,
  DELTA_TEMPLATE_ID,
  createDeltaRows,
  isDeltaTableComplete,
} from '../../../data/deltaTableTemplate';

export default function DeltaTableEditor({ task, submission, canSubmit, onSave }) {
  const [rows, setRows] = useState(() => submission?.templateData?.rows || createDeltaRows());
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (submission?.templateData?.rows?.length) {
      setRows(submission.templateData.rows);
    } else {
      setRows(createDeltaRows());
    }
    setValidationError('');
  }, [task.id, submission?.templateData]);

  const complete = useMemo(() => isDeltaTableComplete(rows), [rows]);

  const updateCell = (rowIdx, key, value) => {
    setRows((prev) => prev.map((row, index) => (index === rowIdx ? { ...row, [key]: value } : row)));
    if (validationError) setValidationError('');
  };

  const handleSave = async () => {
    if (!complete) {
      setValidationError('Fill every block in the table before submitting.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ templateId: DELTA_TEMPLATE_ID, rows });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mbw-submission mbw-errc mbw-delta">
      <p className="mbw-task__hint">
        {task.description || 'Complete your Delta / Milestone Table below — every block must be filled.'}
      </p>

      <div className="mbw-errc__cards">
        {rows.map((row, rowIdx) => (
          <div key={row.timeline} className="mbw-errc-card">
            <p className="mbw-errc-card__task">{row.timeline}</p>
            {DELTA_COLUMNS.map((col) => (
              <label key={col.key} className="mbw-errc-card__field">
                <span>{col.label}</span>
                <textarea
                  rows={3}
                  value={row[col.key] || ''}
                  onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                  placeholder={`${row.timeline} — ${col.label}`}
                  required
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="mbw-errc__wrap mbw-errc__wrap--desktop">
        <table className="mbw-errc__table">
          <caption className="sr-only">Delta / Milestone Table</caption>
          <thead>
            <tr>
              <th className="mbw-errc__th-tasks">Timeline</th>
              {DELTA_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.timeline}>
                <th scope="row" className="mbw-errc__task-label">
                  {row.timeline}
                </th>
                {DELTA_COLUMNS.map((col) => (
                  <td key={col.key}>
                    <textarea
                      rows={4}
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                      placeholder={col.label}
                      aria-label={`${row.timeline} — ${col.label}`}
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
          {saving ? 'Saving…' : task.uploadSubmitLabel || 'Submit delta table'}
        </button>
      </div>
    </div>
  );
}
