import { useEffect, useState } from 'react';
import { ERRC_COLUMNS, createErrcRows } from '../../../data/errcTemplate';

export default function EditableTemplate({ task, submission, canSubmit, onSave }) {
  const [rows, setRows] = useState(
    () => submission?.templateData?.rows || createErrcRows()
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (submission?.templateData?.rows?.length) {
      setRows(submission.templateData.rows);
    } else {
      setRows(createErrcRows());
    }
  }, [task.id, submission?.templateData]);

  const updateCell = (rowIdx, col, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ rows });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mbw-submission mbw-errc">
      <p className="mbw-task__hint">{task.description}</p>

      <div className="mbw-errc__cards">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="mbw-errc-card">
            <p className="mbw-errc-card__task">{row.activity || `Task ${rowIdx + 1}`}</p>
            {ERRC_COLUMNS.map((col) => (
              <label key={col} className="mbw-errc-card__field">
                <span>{col}</span>
                <textarea
                  rows={2}
                  value={row[col] || ''}
                  onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                  placeholder={col}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="mbw-errc__wrap mbw-errc__wrap--desktop">
        <table className="mbw-errc__table">
          <thead>
            <tr>
              <th className="mbw-errc__th-tasks">Tasks</th>
              {ERRC_COLUMNS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <th scope="row" className="mbw-errc__task-label">
                  {row.activity || `Task ${rowIdx + 1}`}
                </th>
                {ERRC_COLUMNS.map((col) => (
                  <td key={col}>
                    <textarea
                      rows={3}
                      value={row[col] || ''}
                      onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                      placeholder={col}
                      aria-label={`${row.activity || `Task ${rowIdx + 1}`} — ${col}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mbw-submission__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save submission'}
        </button>
      </div>
    </div>
  );
}
