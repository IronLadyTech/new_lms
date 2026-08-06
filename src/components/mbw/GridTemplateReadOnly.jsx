import { getFormTemplate } from '../../data/formTemplates/registry';

export default function GridTemplateReadOnly({ templateId, rows = [] }) {
  const definition = getFormTemplate(templateId);
  if (!definition || !rows.length) return <p className="muted">No table data.</p>;

  const rowLabelKey = definition.rowKey || 'label';
  const firstColumnHeader =
    templateId === 'super-power' ? 'Row' : templateId === 'theme' ? 'Theme' : 'Item';

  return (
    <div className="mbw-errc__wrap mbw-errc__wrap--readonly mbw-grid-template">
      <table className="mbw-errc__table">
        <thead>
          <tr>
            <th className="mbw-errc__th-tasks">{firstColumnHeader}</th>
            {definition.columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[rowLabelKey]}-${index}`}>
              <th scope="row" className="mbw-errc__task-label">
                {row[rowLabelKey] || '—'}
              </th>
              {definition.columns.map((col) => (
                <td key={col.key}>{row[col.key]?.trim() || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
