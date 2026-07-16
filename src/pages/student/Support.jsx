import { useEffect, useState } from 'react';
import { LifeBuoy, Inbox, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createTicket,
  getUserTickets,
  getTicketMessages,
  replyToTicket,
  updateTicket,
  deleteTicket,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  categoryLabel,
  statusLabel,
} from '../../services/ticketService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

export default function Support() {
  const { user, profile, isGuest } = useAuth();
  const { confirm, dialogProps } = useConfirm();
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: 'course', subject: '', message: '' });
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null); // { text, ok }
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editForm, setEditForm] = useState({ subject: '', category: 'course' });

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTickets(await getUserTickets(user.uid));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    getTicketMessages(selectedId).then(setMessages).catch(console.error);
  }, [selectedId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const ticket = await createTicket({
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: profile?.displayName || user.displayName,
        category: form.category,
        subject: form.subject,
        message: form.message,
      });
      setForm({ category: 'course', subject: '', message: '' });
      setNotice({ text: 'Ticket submitted. Super Admin will respond soon.', ok: true });
      await loadTickets();
      setSelectedId(ticket.id);
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!user || !selectedId || !reply.trim()) return;
    setSubmitting(true);
    try {
      await replyToTicket(selectedId, {
        senderId: user.uid,
        senderName: profile?.displayName || user.email?.split('@')[0],
        senderRole: 'user',
        text: reply.trim(),
      });
      setReply('');
      setMessages(await getTicketMessages(selectedId));
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditTicket = (ticket) => {
    setEditingTicketId(ticket.id);
    setEditForm({ subject: ticket.subject, category: ticket.category });
    setSelectedId(ticket.id);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTicketId) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await updateTicket(editingTicketId, {
        subject: editForm.subject.trim(),
        category: editForm.category,
      });
      setEditingTicketId(null);
      setNotice({ text: 'Ticket updated.', ok: true });
      await loadTickets();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    const ok = await confirm({
      title: 'Delete ticket',
      message: 'Delete this ticket? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await deleteTicket(ticketId);
      if (selectedId === ticketId) setSelectedId(null);
      if (editingTicketId === ticketId) setEditingTicketId(null);
      setNotice({ text: 'Ticket deleted.', ok: true });
      await loadTickets();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const selected = tickets.find((t) => t.id === selectedId);

  if (isGuest) {
    return (
      <div className="page support-page">
        <PageHeader eyebrow="Help" icon={LifeBuoy} title="Help & support" />
        <GuestLockedPanel title="Support locked" />
      </div>
    );
  }

  return (
    <div className="page support-page">
      <PageHeader
        eyebrow="Help"
        icon={LifeBuoy}
        title="Help & support"
        subtitle="Report course, login, or payment issues. Messages go to Super Admin."
      />

      {notice && (
        <p
          className={`alert ${notice.ok ? 'alert-success' : 'alert-error'}`}
          role={notice.ok ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}

      <SectionCard title="Create a ticket" icon={MessageSquarePlus} className="support-section">
        <form className="admin-form admin-form--stacked" onSubmit={handleCreate}>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
            aria-label="Category"
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
            aria-label="Subject"
          />
          <textarea
            placeholder="Describe your issue…"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            required
            aria-label="Message"
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit ticket'}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="My tickets" icon={Inbox} className="support-section">
        {loading ? (
          <div className="dashboard-skeleton" aria-busy="true">
            <div className="dashboard-skeleton__block" style={{ minHeight: '3.5rem' }} />
            <div className="dashboard-skeleton__block" style={{ minHeight: '3.5rem' }} />
            <div className="dashboard-skeleton__block" style={{ minHeight: '3.5rem' }} />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No tickets yet"
            message="Raised a question above? Your tickets and replies from the team will show up here."
          />
        ) : (
          <div className="ticket-layout">
            <ul className="ticket-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`ticket-list__item${selectedId === t.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <strong>{t.subject}</strong>
                    <span className={`ticket-status ticket-status--${t.status}`}>
                      {statusLabel(t.status)}
                    </span>
                    <span className="muted">
                      {categoryLabel(t.category)} · {formatTime(t.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="ticket-thread">
                <div className="ticket-thread__header">
                  <h3>{selected.subject}</h3>
                  <div className="ticket-thread__header-actions">
                    <span className={`ticket-status ticket-status--${selected.status}`}>
                      {statusLabel(selected.status)}
                    </span>
                    {selected.status === TICKET_STATUSES.OPEN && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => startEditTicket(selected)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTicket(selected.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingTicketId === selected.id && (
                  <form
                    className="admin-form admin-form--stacked ticket-edit-form"
                    onSubmit={handleSaveEdit}
                  >
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      required
                      aria-label="Category"
                    >
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editForm.subject}
                      onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                      required
                      aria-label="Subject"
                    />
                    <div className="ticket-actions">
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={submitting}
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setEditingTicketId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="ticket-messages">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`ticket-message${m.senderRole === 'user' ? ' ticket-message--user' : ' ticket-message--staff'}`}
                    >
                      <div className="ticket-message__meta">
                        <strong>{m.senderName}</strong>
                        <span className="muted">{formatTime(m.createdAt)}</span>
                      </div>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="muted">No messages yet.</p>}
                </div>
                {selected.status !== TICKET_STATUSES.RESOLVED && (
                  <form className="ticket-reply" onSubmit={handleReply}>
                    <textarea
                      placeholder="Add a reply…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      required
                      aria-label="Reply"
                    />
                    <button type="submit" className="btn btn-outline btn-sm" disabled={submitting}>
                      Send reply
                    </button>
                  </form>
                )}
                {selected.status === TICKET_STATUSES.RESOLVED && (
                  <p className="success-text">This issue has been resolved.</p>
                )}
              </div>
            )}
          </div>
        )}
      </SectionCard>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
