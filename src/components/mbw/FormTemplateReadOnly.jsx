import { getFormTemplate, tableTotals } from '../../data/formTemplates/registry';

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

const filled = (value) => String(value ?? '').trim().length > 0;

/*
 * A table answer as a reviewer reads it. Spare rows the learner left empty are
 * dropped: five rows offered for key relationships, two used, reads as two. A
 * choice column shows the option picked, and a table with totals shows them.
 */
function TableReadOnly({ field, rows }) {
  const printed = Boolean(field.rowLabels?.length);
  const allRows = Array.isArray(rows) ? rows : [];
  const shown = allRows.filter(
    (row) =>
      (printed && field.minRows == null) || field.columns.some((col) => filled(row?.[col.key]))
  );
  if (!shown.length) return <p className="muted">—</p>;

  const totals = field.totals ? tableTotals(field, allRows) : null;

  return (
    <div className="mbw-errc__wrap mbw-errc__wrap--readonly">
      <table className="mbw-errc__table">
        <caption className="sr-only">{field.label}</caption>
        <thead>
          <tr>
            {printed && (
              <th scope="col" className="mbw-errc__th-tasks">
                {field.rowHeader || 'Item'}
              </th>
            )}
            {field.columns.map((col) => (
              <th key={col.key} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={index}>
              {printed && (
                <th scope="row" className="mbw-errc__task-label">
                  {row.label}
                </th>
              )}
              {field.columns.map((col) => (
                <td key={col.key}>{String(row?.[col.key] ?? '').trim() || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              {printed && <th scope="row">Total</th>}
              {field.columns.map((col, colIndex) => (
                <td key={col.key}>
                  {col.type === 'choice'
                    ? (col.options || [])
                        .map((option) => `${option}: ${totals[col.key][option]}`)
                        .join(' · ')
                    : !printed && colIndex === 0
                      ? 'Total'
                      : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function FormTemplateReadOnly({ templateId, fields = {} }) {
  const definition = getFormTemplate(templateId);
  if (!definition?.fields?.length) return <p className="muted">No form data.</p>;

  const groups = groupFields(definition.fields);

  return (
    <div className="mbw-form-template mbw-form-template--readonly">
      {groups.map((group) => (
        <section key={group.section} className="mbw-form-template__section">
          <h3 className="mbw-form-template__section-title">{group.section}</h3>
          <dl className="mbw-form-template__dl">
            {group.fields.map((field) => {
              // Checked before the text path: a table's value is an array, and
              // `.trim()` on it throws.
              if (field.type === 'table') {
                return (
                  <div key={field.key} className="mbw-form-template__dl-row">
                    <dt>{field.label}</dt>
                    <dd>
                      <TableReadOnly field={field} rows={fields[field.key]} />
                    </dd>
                  </div>
                );
              }
              const value = typeof fields[field.key] === 'string' ? fields[field.key].trim() : '';
              // How a question used to be asked: shown only where an older
              // submission actually answered it that way.
              if (field.legacy && !value) return null;
              if (!value && field.required === false) return null;
              return (
                <div key={field.key} className="mbw-form-template__dl-row">
                  <dt>
                    {field.label}
                    {field.legacy && <span className="muted"> (earlier answer)</span>}
                  </dt>
                  <dd>{value || '—'}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
