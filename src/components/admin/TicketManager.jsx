import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllTickets,
  getTicketMessages,
  assignTicket,
  resolveTicket,
  reopenTicket,
  replyToTicket,
  updateTicket,
  deleteTicket,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  categoryLabel,
  statusLabel,
} from '../../services/ticketService';
import { ROLES } from '../../utils/roles';

function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

export default function TicketManager({ users, isSuperAdmin, onRefresh }) {
  const { user, profile, role } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('open');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const staffUsers = users.filter((u) =>
    [ROLES.ADMIN, ROLES.MODERATOR, ROLES.SUPERADMIN].includes(u.role)
  );

  const loadTickets = async () => {
    setLoading(true);
    try {
      setTickets(await getAllTickets());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    getTicketMessages(selectedId).then(setMessages).catch(console.error);
  }, [selectedId]);

  const filtered = tickets.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'open') return t.status === TICKET_STATUSES.OPEN;
    if (filter === 'assigned') return t.status === TICKET_STATUSES.ASSIGNED;
    if (filter === 'resolved') return t.status === TICKET_STATUSES.RESOLVED;
    if (filter === 'mine') return t.assignedTo === user?.uid;
    return true;
  });

  const openCount = tickets.filter((t) => t.status !== TICKET_STATUSES.RESOLVED).length;
  const selected = tickets.find((t) => t.id === selectedId);

  const handleAssign = async (adminId) => {
    if (!selectedId || !adminId) return;
    const admin = users.find((u) => u.id === adminId);
    try {
      await assignTicket(selectedId, {
        assignedTo: adminId,
        assignedToName: admin?.displayName || admin?.email,
      });
      setMsg(`Assigned to ${admin?.displayName || admin?.email}`);
      await loadTickets();
      onRefresh?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleResolve = async () => {
    if (!selectedId) return;
    try {
      await resolveTicket(selectedId);
      await replyToTicket(selectedId, {
        senderId: user.uid,
        senderName: profile?.displayName || 'Support',
        senderRole: isSuperAdmin ? 'superadmin' : 'admin',
        text: 'This issue has been marked as resolved. Contact us if you need more help.',
      });
      setMsg('Ticket resolved.');
      setMessages(await getTicketMessages(selectedId));
      await loadTickets();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleReopen = async () => {
    if (!selectedId) return;
    try {
      await reopenTicket(selectedId);
      setMsg('Ticket reopened.');
      await loadTickets();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this ticket permanently?')) return;
    try {
      await deleteTicket(selectedId);
      setSelectedId(null);
      setMsg('Ticket deleted.');
      await loadTickets();
      onRefresh?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleEditSubject = async () => {
    if (!selectedId || !selected) return;
    const subject = window.prompt('Edit ticket subject', selected.subject);
    if (!subject?.trim() || subject.trim() === selected.subject) return;
    try {
      await updateTicket(selectedId, { subject: subject.trim() });
      setMsg('Ticket updated.');
      await loadTickets();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    try {
      await replyToTicket(selectedId, {
        senderId: user.uid,
        senderName: profile?.displayName || user.email?.split('@')[0],
        senderRole: isSuperAdmin ? 'superadmin' : 'admin',
        text: reply.trim(),
      });
      setReply('');
      setMessages(await getTicketMessages(selectedId));
      setMsg('Reply sent to user.');
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <section>
      <h2>Support tickets {openCount > 0 && <span className="badge badge-alert">{openCount} open</span>}</h2>
      <p className="muted">
        User messages about course, login &amp; payment issues.
        {isSuperAdmin ? ' Assign tickets to admins and reply directly.' : ' Reply to assigned tickets.'}
      </p>

      {msg && <p className={msg.includes('resolved') || msg.includes('sent') || msg.includes('Assigned') ? 'success-text' : 'alert alert-error'}>{msg}</p>}

      <div className="admin-form ticket-filters">
        {[
          { id: 'open', label: 'Open' },
          { id: 'assigned', label: 'Assigned' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'mine', label: 'Assigned to me' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={loadTickets}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading tickets…</p>
      ) : (
        <div className="ticket-layout ticket-layout--admin">
          <ul className="ticket-list">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`ticket-list__item${selectedId === t.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <strong>{t.subject}</strong>
                  <span className="muted">{t.userDisplayName} · {t.userEmail}</span>
                  <span className={`ticket-status ticket-status--${t.status}`}>{statusLabel(t.status)}</span>
                  <span className="muted">{categoryLabel(t.category)}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="muted">No tickets in this filter.</li>}
          </ul>

          {selected && (
            <div className="ticket-thread">
              <div className="ticket-thread__header">
                <div>
                  <h3>{selected.subject}</h3>
                  <p className="muted">
                    From {selected.userDisplayName} ({selected.userEmail}) · {categoryLabel(selected.category)}
                  </p>
                </div>
                <span className={`ticket-status ticket-status--${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>

              {(isSuperAdmin || role === ROLES.ADMIN) && (
                <div className="admin-form ticket-actions">
                  <select
                    defaultValue={selected.assignedTo || ''}
                    onChange={(e) => handleAssign(e.target.value)}
                  >
                    <option value="">Assign to admin…</option>
                    {staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.email})
                      </option>
                    ))}
                  </select>
                  {selected.assignedToName && (
                    <span className="muted">Assigned: {selected.assignedToName}</span>
                  )}
                  <div className="admin-list__actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleEditSubject}>
                      Edit subject
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
                      Delete ticket
                    </button>
                  </div>
                </div>
              )}

              <div className="ticket-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`ticket-message${m.senderRole === 'user' ? ' ticket-message--user' : ' ticket-message--staff'}`}
                  >
                    <div className="ticket-message__meta">
                      <strong>{m.senderName}</strong>
                      <span className="badge">{m.senderRole}</span>
                      <span className="muted">{formatTime(m.createdAt)}</span>
                    </div>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>

              {selected.status !== TICKET_STATUSES.RESOLVED ? (
                <>
                  <form className="ticket-reply" onSubmit={handleReply}>
                    <textarea
                      placeholder="Message user directly…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={3}
                      required
                    />
                    <div className="ticket-actions">
                      <button type="submit" className="btn btn-primary btn-sm">
                        Send message
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={handleResolve}>
                        Mark resolved
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="ticket-actions">
                  <p className="success-text">Resolved {formatTime(selected.resolvedAt)}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleReopen}>
                    Reopen ticket
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
