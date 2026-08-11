import { useMemo, useState } from 'react';
import { Inbox, Mail, CheckCircle2, Archive, Trash2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { getProgramShortLabel } from '../../data/programTypes';
import {
  ACCESS_REQUEST_FILTERS,
  ACCESS_REQUEST_STATUSES,
  accessRequestStatusLabel,
  deleteAccessRequest,
  setAccessRequestStatus,
} from '../../services/accessRequestService';

function formatTime(ts) {
  if (!ts) return 'Just now';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}

/**
 * Guest programme enquiries captured by GuestRequestAccess.
 *
 * These are inbound leads from people without accounts — the only place in the
 * product where they surface, so the list never silently truncates or hides a
 * status behind a default filter.
 */
export default function AccessRequestManager({ requests = [], onReload }) {
  const { confirm, dialogProps } = useConfirm();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    const byStatus = { all: requests.length };
    for (const f of ACCESS_REQUEST_FILTERS) {
      if (f.id === 'all') continue;
      byStatus[f.id] = requests.filter(
        (r) => (r.status || ACCESS_REQUEST_STATUSES.NEW) === f.id
      ).length;
    }
    return byStatus;
  }, [requests]);

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((r) => (r.status || ACCESS_REQUEST_STATUSES.NEW) === filter);
  }, [requests, filter]);

  const runAction = async (id, fn) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      await onReload?.();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not update this request. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (request) => {
    const ok = await confirm({
      title: 'Delete request',
      message: `Delete the enquiry from ${request.name || request.email}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    runAction(request.id, () => deleteAccessRequest(request.id));
  };

  return (
    <section>
      <h2>Access requests ({requests.length})</h2>
      <p className="muted">
        Programme enquiries from guests who do not have an account yet. Reply by email, then mark
        the request contacted so the queue stays accurate.
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="access-request__filters" role="group" aria-label="Filter access requests">
        {ACCESS_REQUEST_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-outline'}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({counts[f.id] ?? 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={requests.length === 0 ? 'No access requests yet' : 'Nothing in this view'}
          message={
            requests.length === 0
              ? 'When a guest submits the “Request programme access” form, their enquiry appears here.'
              : 'Try a different filter to see the rest of the queue.'
          }
        />
      ) : (
        <ul className="admin-list access-request-list">
          {visible.map((r) => {
            const status = r.status || ACCESS_REQUEST_STATUSES.NEW;
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="access-request">
                <div className="access-request__body">
                  <div className="access-request__head">
                    <strong>{r.name || 'Unnamed'}</strong>
                    <span className={`badge access-request__status--${status}`}>
                      {accessRequestStatusLabel(status)}
                    </span>
                    {r.program && (
                      <span className="badge badge-program">{getProgramShortLabel(r.program)}</span>
                    )}
                  </div>
                  <a href={`mailto:${r.email}`} className="access-request__email">
                    <Mail size={14} aria-hidden="true" />
                    {r.email}
                  </a>
                  {r.message && <p className="access-request__message">{r.message}</p>}
                  <p className="muted access-request__time">{formatTime(r.createdAt)}</p>
                </div>

                <div className="access-request__actions">
                  {status !== ACCESS_REQUEST_STATUSES.CONTACTED && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={busy}
                      onClick={() =>
                        runAction(r.id, () =>
                          setAccessRequestStatus(r.id, ACCESS_REQUEST_STATUSES.CONTACTED)
                        )
                      }
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      Mark contacted
                    </button>
                  )}
                  {status !== ACCESS_REQUEST_STATUSES.CLOSED && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={busy}
                      onClick={() =>
                        runAction(r.id, () =>
                          setAccessRequestStatus(r.id, ACCESS_REQUEST_STATUSES.CLOSED)
                        )
                      }
                    >
                      <Archive size={14} aria-hidden="true" />
                      Close
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={() => handleDelete(r)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
