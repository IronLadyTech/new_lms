import { ERRC_COLUMNS } from '../../data/errcTemplate';

export default function ErrcReadOnlyTable({ rows = [] }) {
  if (!rows.length) return <p className="muted">No ERRC data.</p>;

  return (
    <div className="mbw-errc__wrap mbw-errc__wrap--readonly">
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
          {rows.map((row, i) => (
            <tr key={i}>
              <th scope="row" className="mbw-errc__task-label">
                {row.activity || '—'}
              </th>
              {ERRC_COLUMNS.map((col) => (
                <td key={col}>{row[col] || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
