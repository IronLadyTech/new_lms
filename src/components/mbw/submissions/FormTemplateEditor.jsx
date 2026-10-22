import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import {
  createTableRows,
  createTemplateFields,
  getFormTemplate,
  isFieldValueFilled,
  isTemplateComplete,
  tableTotals,
  templateRequirements,
} from '../../../data/formTemplates/registry';
import { changedTemplateCells } from '../../../utils/submissionVersions';
import {
  clearTemplateDraft,
  readTemplateDraft,
  writeTemplateDraft,
} from '../../../utils/templateDrafts';

/* How many rows a learner can grow a table they write to. */
const MAX_TABLE_ROWS = 12;

function groupFields(fields = []) {
  const groups = [];
  const seen = new Set();
  fields.forEach((field) => {
    const section = field.section || 'Details';
    if (!seen.has(section)) {
      seen.add(section);
      groups.push({
        section,
        fields: fields.filter((item) => (item.section || 'Details') === section),
      });
    }
  });
  return groups;
}

/**
 * A worksheet's table, typed into on the page.
 *
 * It uses the ERRC editor's two renderings: cards under 768px, where a
 * three-column table would need sideways scrolling to read, and a table from
 * 768px. Both stay in the DOM and CSS shows one, so each cell carries its own
 * row-and-column label instead of relying on the table's headers.
 *
 * A `choice` column is a pick, not text: I Respond or I React, Yes or No. On the
 * table each option is its own column, as the worksheets print them; on a card
 * it is a radio group. A table with `totals` counts the picks underneath.
 *
 * `canAddRow` lets a learner grow a table whose rows they write themselves.
 * A table with printed rows is the worksheet's own list and never grows.
 */
function TableField({ field, rows, onChange, canAddRow = false, changed = null, locked = false }) {
  const printed = Boolean(field.rowLabels?.length);
  const rowName = (row, index) => (printed ? row.label : `${field.rowNoun || 'Row'} ${index + 1}`);
  const hasChoice = field.columns.some((col) => col.type === 'choice');
  const totals = field.totals ? tableTotals(field, rows) : null;
  const addable =
    !locked && canAddRow && !printed && rows.length < (field.maxRows ?? MAX_TABLE_ROWS);

  const update = (rowIndex, key, value) =>
    onChange(rows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)));

  const addRow = () =>
    onChange([...rows, Object.fromEntries(field.columns.map((col) => [col.key, '']))]);

  const totalsLine = totals
    ? field.columns
        .filter((col) => col.type === 'choice')
        .flatMap((col) =>
          (col.options || []).map((option) => `${option}: ${totals[col.key][option]}`)
        )
        .join(' · ')
    : '';

  return (
    <div className="mbw-table-field">
      {field.label && <p className="mbw-table-field__label">{field.label}</p>}
      {field.hint && <p className="mbw-form-template__hint muted">{field.hint}</p>}

      <div className="mbw-errc__cards">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="mbw-errc-card">
            <p className="mbw-errc-card__task">{rowName(row, rowIndex)}</p>
            {field.columns.map((col) =>
              col.type === 'choice' ? (
                <fieldset
                  key={col.key}
                  className="mbw-errc-card__field mbw-table-field__choice-group"
                >
                  <legend>{col.label}</legend>
                  {(col.options || []).map((option) => (
                    <label key={option} className="mbw-form-template__radio">
                      <input
                        type="radio"
                        name={`card-${field.key}-${rowIndex}-${col.key}`}
                        value={option}
                        checked={row[col.key] === option}
                        disabled={locked}
                        onChange={() => update(rowIndex, col.key, option)}
                        aria-label={`${rowName(row, rowIndex)} — ${option}`}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label key={col.key} className="mbw-errc-card__field">
                  <span>{col.label}</span>
                  <textarea
                    rows={2}
                    readOnly={locked}
                    className={
                      changed?.has(`${field.key}:${rowIndex}:${col.key}`) ? 'is-changed' : undefined
                    }
                    value={row[col.key] || ''}
                    onChange={(e) => update(rowIndex, col.key, e.target.value)}
                    aria-label={`${rowName(row, rowIndex)} — ${col.label}`}
                  />
                </label>
              )
            )}
          </div>
        ))}
        {totals && <p className="mbw-table-field__totals">Total — {totalsLine}</p>}
      </div>

      <div className="mbw-errc__wrap mbw-errc__wrap--desktop">
        <table className="mbw-errc__table">
          <caption className="sr-only">{field.label}</caption>
          <thead>
            <tr>
              {printed && (
                <th scope="col" rowSpan={hasChoice ? 2 : 1} className="mbw-errc__th-tasks">
                  {field.rowHeader || 'Item'}
                </th>
              )}
              {field.columns.map((col) =>
                col.type === 'choice' ? (
                  <th key={col.key} scope="colgroup" colSpan={(col.options || []).length}>
                    {col.label}
                  </th>
                ) : (
                  <th key={col.key} scope="col" rowSpan={hasChoice ? 2 : 1}>
                    {col.label}
                  </th>
                )
              )}
            </tr>
            {hasChoice && (
              <tr>
                {field.columns
                  .filter((col) => col.type === 'choice')
                  .flatMap((col) =>
                    (col.options || []).map((option) => (
                      <th
                        key={`${col.key}-${option}`}
                        scope="col"
                        className="mbw-table-field__choice"
                      >
                        {option}
                      </th>
                    ))
                  )}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {printed && (
                  <th scope="row" className="mbw-errc__task-label">
                    {row.label}
                  </th>
                )}
                {field.columns.flatMap((col) =>
                  col.type === 'choice'
                    ? (col.options || []).map((option) => (
                        <td key={`${col.key}-${option}`} className="mbw-table-field__choice">
                          <label>
                            <input
                              type="radio"
                              name={`table-${field.key}-${rowIndex}-${col.key}`}
                              value={option}
                              checked={row[col.key] === option}
                              disabled={locked}
                              onChange={() => update(rowIndex, col.key, option)}
                              aria-label={`${rowName(row, rowIndex)} — ${option}`}
                            />
                          </label>
                        </td>
                      ))
                    : [
                        <td key={col.key}>
                          <textarea
                            rows={3}
                            readOnly={locked}
                            className={
                              changed?.has(`${field.key}:${rowIndex}:${col.key}`)
                                ? 'is-changed'
                                : undefined
                            }
                            value={row[col.key] || ''}
                            onChange={(e) => update(rowIndex, col.key, e.target.value)}
                            aria-label={`${rowName(row, rowIndex)} — ${col.label}`}
                          />
                        </td>,
                      ]
                )}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr>
                {printed && <th scope="row">Total</th>}
                {field.columns.flatMap((col, colIndex) =>
                  col.type === 'choice'
                    ? (col.options || []).map((option) => (
                        <td key={`${col.key}-${option}`} className="mbw-table-field__choice">
                          {totals[col.key][option]}
                        </td>
                      ))
                    : [<td key={col.key}>{!printed && colIndex === 0 ? 'Total' : ''}</td>]
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {addable && (
        <button type="button" className="mbw-table-field__add" onClick={addRow}>
          <Plus size={16} aria-hidden="true" />
          {`Add a ${(field.rowNoun || 'row').toLowerCase()}`}
        </button>
      )}
    </div>
  );
}

/**
 * A form template: sections of questions, some of them tables.
 *
 * `guidance` (LEP) adds what the page used to leave to trial and error: a
 * checklist of what the worksheet needs, the one thing still missing written
 * beside Submit, and a way to add rows to a table the learner writes. Without
 * it the form is exactly as MBW has always had it.
 *
 * `locked` (LEP) shows handed-in work as the same worksheet, with nothing to type
 * into and no Submit, until the learner chooses to edit it. An answer to a
 * question the worksheet no longer asks is shown too, marked as earlier.
 */
export default function FormTemplateEditor({
  templateId,
  task,
  submission,
  canSubmit,
  onSave,
  guidance = false,
  submitLabel = '',
  compareTo = null,
  draftKey = '',
  locked = false,
  onDraftChange,
  onDiscard,
}) {
  const definition = getFormTemplate(templateId);
  /*
   * What the form opens with: the saved answer, then any draft left on this
   * device on top of it, so an interrupted edit picks up where it stopped.
   */
  const startingFields = () => {
    const saved = {
      ...createTemplateFields(templateId),
      ...(submission?.templateData?.templateId === templateId
        ? submission.templateData.fields
        : {}),
    };
    const draft = readTemplateDraft(draftKey);
    return draft ? { ...saved, ...draft.fields } : saved;
  };
  const [fields, setFields] = useState(startingFields);
  const [draftSavedAt, setDraftSavedAt] = useState(() => readTemplateDraft(draftKey)?.savedAt || null);
  const draftTimer = useRef(null);
  useEffect(() => () => clearTimeout(draftTimer.current), []);
  /*
   * A page that shows the draft's save time elsewhere (LEP's work panel header)
   * hears about every change here. Held in a ref so a new callback each render
   * never re-runs the effects below.
   */
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const noteDraft = (at) => {
    setDraftSavedAt(at);
    onDraftChangeRef.current?.(at);
  };
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setFields(startingFields());
    setValidationError('');
    noteDraft(readTemplateDraft(draftKey)?.savedAt || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, task.id, submission?.templateData, draftKey]);

  /* While editing a handed-in version: what differs from it, and whether anything does. */
  const changed = useMemo(
    () => (compareTo ? changedTemplateCells(definition, compareTo, fields) : null),
    [compareTo, definition, fields]
  );
  const noChanges = Boolean(changed) && changed.size === 0;

  const complete = useMemo(() => isTemplateComplete(templateId, { fields }), [templateId, fields]);
  const requirements = useMemo(
    () => (guidance ? templateRequirements(templateId, fields) : { items: [], reason: '' }),
    [guidance, templateId, fields]
  );
  // A `legacy` field is how a question used to be asked. It is kept for
  // reviewers reading older submissions, and is never asked again.
  const groups = useMemo(
    () =>
      groupFields(
        (definition?.fields || []).filter(
          (field) => !field.legacy || (locked && isFieldValueFilled(fields[field.key]))
        )
      ),
    [definition, locked, fields]
  );
  const hasTable = useMemo(
    () => (definition?.fields || []).some((field) => field.type === 'table'),
    [definition]
  );

  const updateField = (key, value) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      if (draftKey) {
        clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => {
          const at = writeTemplateDraft(draftKey, next);
          if (at) noteDraft(at);
        }, 800);
      }
      return next;
    });
    if (validationError) setValidationError('');
  };

  const handleSave = async () => {
    if (!complete) {
      setValidationError(
        hasTable
          ? 'Fill every required block before submitting. In a table, finish or clear any half-filled row.'
          : 'Fill every required block before submitting.'
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({ templateId, fields });
      clearTimeout(draftTimer.current);
      clearTemplateDraft(draftKey);
      noteDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const saveDraftNow = () => {
    clearTimeout(draftTimer.current);
    const at = writeTemplateDraft(draftKey, fields);
    if (at) noteDraft(at);
  };

  if (!definition) return null;

  const renderField = (field) => {
    if (field.type === 'table') {
      const saved = fields[field.key];
      return (
        <TableField
          key={field.key}
          field={field}
          rows={Array.isArray(saved) && saved.length ? saved : createTableRows(field)}
          onChange={(rows) => updateField(field.key, rows)}
          canAddRow={guidance && canSubmit}
          changed={changed}
          locked={locked}
        />
      );
    }

    const value = fields[field.key] || '';
    const label = field.legacy ? `${field.label} (earlier answer)` : field.label;

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
                  disabled={locked}
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
          <span>{label}</span>
          {field.hint && <span className="mbw-form-template__hint muted">{field.hint}</span>}
          <textarea
            rows={field.rows || 4}
            readOnly={locked}
            className={changed?.has(field.key) ? 'is-changed' : undefined}
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={locked ? '' : field.placeholder || field.label}
            required={!locked && field.required !== false}
          />
        </label>
      );
    }

    return (
      <label key={field.key} className="field">
        <span>{label}</span>
        {field.hint && <span className="mbw-form-template__hint muted">{field.hint}</span>}
        <input
          type="text"
          readOnly={locked}
          value={value}
          onChange={(e) => updateField(field.key, e.target.value)}
          placeholder={locked ? '' : field.placeholder || field.label}
          required={!locked && field.required !== false}
        />
      </label>
    );
  };

  const showGuidance = !locked && guidance && canSubmit && requirements.items.length > 0;

  return (
    <div
      className={`mbw-submission mbw-form-template${locked ? ' mbw-form-template--locked' : ''}`}
    >
      <p className="mbw-task__hint">
        {task.description || 'Complete every block below before submitting.'}
      </p>

      {groups.map((group) => (
        <section key={group.section} className="mbw-form-template__section">
          <h3 className="mbw-form-template__section-title">{group.section}</h3>
          {group.fields.map(renderField)}
        </section>
      ))}

      {showGuidance && (
        <ul className="template-reqs" aria-label="Requirements">
          {requirements.items.map((item) => (
            <li key={item.key} className={item.met ? 'is-met' : undefined}>
              {item.met ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      )}

      {validationError && (
        <p className="alert alert-error" role="alert">
          {validationError}
        </p>
      )}

      {!locked && (
      <div className="mbw-submission__actions">
        {showGuidance && (
          <p className="template-reqs__reason" aria-live="polite">
            {noChanges ? 'No changes yet.' : requirements.reason || 'Ready to submit.'}
          </p>
        )}
        {draftKey && draftSavedAt && !onDraftChange && (
          <span className="template-draft">
            {`Draft saved on this device · ${new Date(draftSavedAt).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            })}`}
          </span>
        )}
        {onDiscard && (
          <button type="button" className="template-actions__discard" onClick={onDiscard}>
            Discard changes
          </button>
        )}
        {draftKey && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={saving || noChanges}
            onClick={saveDraftNow}
          >
            Save draft
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit || saving || !complete || noChanges}
          onClick={handleSave}
        >
          {saving
            ? 'Saving…'
            : submitLabel || task.uploadSubmitLabel || definition.submitLabel || 'Save submission'}
        </button>
      </div>
      )}
    </div>
  );
}
