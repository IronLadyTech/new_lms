import { DELTA_COLUMNS } from '../../data/deltaTableTemplate';

export default function DeltaReadOnlyTable({ rows = [] }) {
  if (!rows.length) return <p className="muted">No delta table data.</p>;

  return (
    <div className="mbw-errc__wrap mbw-errc__wrap--readonly mbw-delta">
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
          {rows.map((row) => (
            <tr key={row.timeline}>
              <th scope="row" className="mbw-errc__task-label">
                {row.timeline || '—'}
              </th>
              {DELTA_COLUMNS.map((col) => (
                <td key={col.key}>{row[col.key]?.trim() || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
