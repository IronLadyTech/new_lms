import { useMemo, useState } from 'react';
import { AlertTriangle, FileUp, Upload, X } from 'lucide-react';
import { parseSchedule, findDuplicates } from '../../utils/scheduleImport';

/**
 * Paste a programme schedule, see exactly what will be created, then create it.
 *
 * Deliberately two steps. Twenty-six sessions written straight into a batch
 * calendar on one click is not something CX can easily undo — each one would
 * have to be deleted by hand. So nothing is written until the preview has been
 * read, and anything the parser could not understand is shown rather than
 * quietly dropped.
 *
 * @param {object} props
 * @param {number} props.startYear year the programme's first listed month falls in
 * @param {number} props.startMonth 0-indexed first month, so later months that
 *   wrap past December are dated to the following year
 * @param {object[]} props.existingEvents sessions already on this batch calendar
 * @param {(sessions: object[]) => Promise<void>} props.onImport
 * @param {() => void} props.onClose
 */
export default function ScheduleImport({
  startYear,
  startMonth,
  existingEvents = [],
  onImport,
  onClose,
}) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState('');

  const { sessions, problems } = useMemo(
    () => parseSchedule(text, { startYear, startMonth }),
    [text, startYear, startMonth]
  );

  const duplicates = useMemo(
    () => findDuplicates(sessions, existingEvents),
    [sessions, existingEvents]
  );
  const dupeKeys = useMemo(
    () => new Set(duplicates.map((d) => `${d.date}|${d.title}`)),
    [duplicates]
  );

  /* Re-importing a corrected paste is normal, so duplicates are skipped rather
     than blocking the whole import. */
  const toCreate = sessions.filter((s) => !dupeKeys.has(`${s.date}|${s.title}`));
  const warned = sessions.filter((s) => s.warning);

  const handleImport = async () => {
    if (!toCreate.length) return;
    setImporting(true);
    setResult('');
    try {
      await onImport(toCreate);
      setResult(`Added ${toCreate.length} session${toCreate.length === 1 ? '' : 's'}.`);
      setText('');
    } catch (err) {
      setResult(err.message || 'Import failed — nothing further was added.');
    } finally {
      setImporting(false);
    }
  };

  const readFile = async (file) => {
    if (!file) return;
    setText(await file.text());
  };

  return (
    <div className="schedule-import">
      <div className="batch-sessions__form-head">
        <h3>Import a schedule</h3>
        <button type="button" className="batch-sessions__icon-btn" onClick={onClose}>
          <X size={18} aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <p className="muted schedule-import__hint">
        Copy the schedule table — Day, Time, Date, Content, Deliverable — and paste it below. Dates
        without a year are read as {startYear}; months earlier than the programme’s start roll into{' '}
        {startYear + 1}. Nothing is saved until you press Add.
      </p>

      <label className="field">
        <span className="field-label">Paste the schedule</span>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Saturday\t9:00am to 12:00pm\t11th July\tSession 1 …\tCreate a video script'}
        />
      </label>

      <label className="btn btn-outline btn-sm schedule-import__file">
        <FileUp size={16} aria-hidden />
        Or choose a .txt / .csv file
        <input
          type="file"
          accept=".txt,.csv,.tsv,text/plain"
          className="sr-only"
          onChange={(e) => readFile(e.target.files?.[0])}
        />
      </label>

      {text.trim() && (
        <div className="schedule-import__preview">
          <p className="schedule-import__count">
            <strong>{toCreate.length}</strong> to add
            {duplicates.length > 0 && <> · {duplicates.length} already on the calendar, skipped</>}
            {problems.length > 0 && <> · {problems.length} not understood</>}
          </p>

          {warned.length > 0 && (
            <div className="alert alert-error" role="alert">
              <AlertTriangle size={16} aria-hidden />
              <div>
                <strong>
                  {warned.length} session{warned.length === 1 ? '' : 's'} to check before importing:
                </strong>
                <ul>
                  {warned.map((s) => (
                    <li key={`${s.date}|${s.title}`}>
                      {s.date} — {s.title}: {s.warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {problems.length > 0 && (
            <div className="alert alert-error" role="alert">
              <strong>Not imported — these rows could not be read:</strong>
              <ul>
                {problems.map((p) => (
                  <li key={p.line}>
                    Line {p.line}: {p.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="schedule-import__table-wrap">
              <table className="schedule-import__table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Time</th>
                    <th scope="col">Session</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const dupe = dupeKeys.has(`${s.date}|${s.title}`);
                    return (
                      <tr key={`${s.date}|${s.title}`} className={dupe ? 'is-skipped' : ''}>
                        <td>{s.date}</td>
                        <td>
                          {s.time}
                          {s.endTime ? `–${s.endTime}` : ''}
                        </td>
                        <td>{s.title}</td>
                        <td>{dupe ? 'Already there' : s.warning ? 'Check first' : 'Will add'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div
          className={`alert ${result.startsWith('Added') ? 'alert-success' : 'alert-error'}`}
          role="status"
        >
          {result}
        </div>
      )}

      <div className="batch-sessions__form-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!toCreate.length || importing}
          onClick={handleImport}
        >
          <Upload size={16} aria-hidden />
          {importing
            ? 'Adding…'
            : `Add ${toCreate.length || ''} session${toCreate.length === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
