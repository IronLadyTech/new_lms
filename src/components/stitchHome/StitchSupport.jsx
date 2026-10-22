import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Send,
  Trash2,
  Pencil,
  Inbox,
  ArrowLeft,
  Check,
  AlertCircle,
  Search,
  KeyRound,
  UserPen,
  LockKeyhole,
  BadgeIndianRupee,
  Bookmark,
  CalendarClock,
  BellRing,
  MonitorPlay,
  Eye,
  Mail,
  Phone,
  Globe,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
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
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { InstagramIcon, YoutubeIcon, LinkedinIcon } from './BrandIcons';
import { FAQ, FAQ_CATEGORIES, CONTACT_CHANNELS, searchFaq } from '../../data/supportFaq';
import '../../styles/stitchAccount.css';

/**
 * Help & Support — answers first, a person second.
 *
 * Most questions have the same answer every time, so they are here to be read
 * rather than queued behind a ticket. What the FAQ cannot settle hands straight
 * to the ticket form, carrying the question with it, so nobody retypes what
 * they were already reading.
 *
 * A ticket is a thread: you say something, someone answers. It is laid out that
 * way — threads on the left, the open one on the right — so a reply reads as a
 * reply rather than a row in a log.
 */

/*
 * One glyph per question, chosen for what the question is actually about.
 * `Video` is lucide's camcorder — a recording mark on a question about a video
 * that will not play; `MonitorPlay` is a screen playing something. `User` was a
 * person on a question about editing your details, so it is a person with a pen.
 */
const FAQ_ICONS = {
  key: KeyRound,
  user: UserPen,
  lock: LockKeyhole,
  card: BadgeIndianRupee,
  play: Bookmark,
  calendar: CalendarClock,
  bell: BellRing,
  video: MonitorPlay,
  shield: Eye,
};

const CONTACT_ICONS = {
  mail: Mail,
  phone: Phone,
  globe: Globe,
  /* lucide v1 carries no brand marks — these come from BrandIcons. */
  linkedin: LinkedinIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
};

const TABS = [
  ['faq', 'FAQs'],
  ['tickets', 'My tickets'],
  ['contact', 'Contact'],
];

const FILTERS = [
  ['all', 'All'],
  [TICKET_STATUSES.OPEN, 'Open'],
  [TICKET_STATUSES.ASSIGNED, 'Assigned'],
  [TICKET_STATUSES.RESOLVED, 'Resolved'],
];

function when(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const sortKey = (t) => t.updatedAt?.toMillis?.() ?? t.createdAt?.toMillis?.() ?? 0;

function Notice({ notice }) {
  if (!notice) return null;
  const Icon = notice.ok ? Check : AlertCircle;
  return (
    <p className={`ac-note ${notice.ok ? 'ok' : 'bad'}`} role="status">
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {notice.text}
    </p>
  );
}

export default function StitchSupport() {
  const { user, profile, isGuest } = useAuth();
  const { confirm, dialogProps } = useConfirm();

  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ category: 'course', subject: '', message: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('faq');
  const [query, setQuery] = useState('');
  const [faqCat, setFaqCat] = useState('all');
  const [openFaq, setOpenFaq] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    getTicketMessages(selectedId).then(setMessages).catch(console.error);
  }, [selectedId]);

  const shown = useMemo(() => {
    const list = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);
    return [...list].sort((a, b) => sortKey(b) - sortKey(a));
  }, [tickets, filter]);

  const counts = useMemo(() => {
    const out = { all: tickets.length };
    Object.values(TICKET_STATUSES).forEach((s) => {
      out[s] = tickets.filter((t) => t.status === s).length;
    });
    return out;
  }, [tickets]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  /*
   * With nothing raised, the two-pane layout is two empty states side by side —
   * "No tickets yet" beside "Pick a ticket to read it" — around a large dead
   * area. There is nothing to list and nothing to read, so the split earns
   * nothing; one invitation does the work.
   */
  const nothingYet = !loading && tickets.length === 0 && !composing;

  const faqShown = useMemo(
    () => searchFaq(faqCat === 'all' ? FAQ : FAQ.filter((f) => f.category === faqCat), query),
    [faqCat, query]
  );

  /*
   * The handoff. Reading an answer and still being stuck is the moment a ticket
   * is worth raising, so the question comes with you into the form instead of
   * being typed out again from memory.
   */
  const askAboutFaq = (faq) => {
    setForm({
      category: faq.ticketCategory || 'other',
      subject: faq.q,
      message: '',
    });
    setOpenFaq(null);
    setSelectedId(null);
    setComposing(true);
    setTab('tickets');
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
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
      setComposing(false);
      setNotice({ text: 'Sent. The team will come back to you here.', ok: true });
      await loadTickets();
      setSelectedId(ticket.id);
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!user || !selectedId || !reply.trim()) return;
    setBusy(true);
    try {
      await replyToTicket(selectedId, {
        senderId: user.uid,
        senderName: profile?.displayName || user.email?.split('@')[0],
        senderRole: 'user',
        text: reply.trim(),
      });
      setReply('');
      setMessages(await getTicketMessages(selectedId));
      await loadTickets();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateTicket(editing.id, {
        subject: editing.subject.trim(),
        category: editing.category,
      });
      setEditing(null);
      setNotice({ text: 'Ticket updated.', ok: true });
      await loadTickets();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const removeTicket = async (id) => {
    const ok = await confirm({
      title: 'Delete ticket',
      message: 'Delete this ticket? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteTicket(id);
      if (selectedId === id) setSelectedId(null);
      if (editing?.id === id) setEditing(null);
      setNotice({ text: 'Ticket deleted.', ok: true });
      await loadTickets();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (isGuest) {
    return (
      <div className="ac">
        <header className="ac-head">
          <h1>Help &amp; Support</h1>
        </header>
        <section className="ac-card">
          <p className="ac-guest">Sign in to raise a ticket and see replies from the team.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="ac">
      <header className="ac-head ac-head--row">
        <div>
          <h1>Help &amp; Support</h1>
          <p>Read an answer, or raise a ticket and the team will reply on it here.</p>
        </div>
        <button
          type="button"
          className="ac-btn ac-btn--primary"
          onClick={() => {
            setForm({ category: 'course', subject: '', message: '' });
            setComposing(true);
            setSelectedId(null);
            setTab('tickets');
          }}
        >
          <Plus size={16} strokeWidth={2.4} aria-hidden />
          New ticket
        </button>
      </header>

      <div className="sup-tabs" role="tablist" aria-label="Help">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`sup-tab${tab === id ? ' on' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'tickets' && tickets.length > 0 && <span>{tickets.length}</span>}
          </button>
        ))}
      </div>

      <Notice notice={notice} />

      {tab === 'faq' && (
        <section className="faq">
          {openFaq ? (
            <article className="faq-answer">
              <div className="sup-pane__h">
                <button
                  type="button"
                  className="sup-back faq-back"
                  onClick={() => setOpenFaq(null)}
                  aria-label="Back to answers"
                >
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
                </button>
                <h2>{openFaq.q}</h2>
              </div>

              <div className="faq-answer__b">
                {openFaq.intro && <p className="faq-intro">{openFaq.intro}</p>}
                <ol className="faq-steps">
                  {openFaq.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {openFaq.note && <p className="faq-note">{openFaq.note}</p>}
              </div>

              <footer className="faq-answer__f">
                <p>Still stuck?</p>
                <button
                  type="button"
                  className="ac-btn ac-btn--primary"
                  onClick={() => askAboutFaq(openFaq)}
                >
                  Ask the team
                </button>
              </footer>
            </article>
          ) : (
            <>
              <label className="faq-search">
                <Search size={16} strokeWidth={2} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What would you like to find?"
                  aria-label="Search help"
                />
              </label>

              <div className="faq-cats" role="tablist" aria-label="Help categories">
                {FAQ_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={faqCat === c.id}
                    className={`sup-cat${faqCat === c.id ? ' on' : ''}`}
                    onClick={() => setFaqCat(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {faqShown.length === 0 ? (
                <div className="sup-none">
                  <Search size={22} strokeWidth={1.7} aria-hidden />
                  <p>Nothing matches “{query}”. Raise a ticket and we will answer it.</p>
                  <button
                    type="button"
                    className="ac-btn ac-btn--quiet"
                    onClick={() => {
                      setForm({ category: 'other', subject: query, message: '' });
                      setComposing(true);
                      setTab('tickets');
                    }}
                  >
                    Ask the team
                  </button>
                </div>
              ) : (
                <ul className="faq-grid">
                  {faqShown.map((f) => {
                    const Icon = FAQ_ICONS[f.icon] || KeyRound;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          className={`faq-card faq-card--${f.tone}`}
                          onClick={() => setOpenFaq(f)}
                        >
                          <span className={`faq-card__i faq-card__i--${f.tone}`} aria-hidden>
                            <Icon size={24} strokeWidth={1.9} />
                          </span>
                          <span className="faq-card__q">{f.q}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'contact' && (
        <section className="ac-card">
          <p className="faq-intro">
            The team answers tickets first — a ticket keeps the whole conversation in one place.
            These reach Iron Lady directly.
          </p>
          <ul className="con">
            {CONTACT_CHANNELS.map((c) => {
              const Icon = CONTACT_ICONS[c.icon] || Mail;
              return (
                <li key={c.id}>
                  <a
                    className="con-row"
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <span className="con-row__i" aria-hidden>
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <span className="con-row__t">
                      <strong>{c.label}</strong>
                      <small>{c.value}</small>
                    </span>
                    {c.external ? (
                      <ExternalLink size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <ChevronRight size={15} strokeWidth={2.2} aria-hidden />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'tickets' && nothingYet && (
        <section className="sup-first">
          <span className="sup-first__i" aria-hidden>
            <Inbox size={26} strokeWidth={1.6} />
          </span>
          <h2>No tickets yet</h2>
          <p>
            Ask the team anything the answers did not cover. Replies land on the ticket, so the
            whole conversation stays in one place.
          </p>
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={() => {
              setForm({ category: 'course', subject: '', message: '' });
              setComposing(true);
            }}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Raise your first ticket
          </button>
        </section>
      )}

      <div
        className={`sup${selected || composing ? ' sup--open' : ''}`}
        hidden={tab !== 'tickets' || nothingYet}
      >
        {/* ---------- threads ---------- */}
        <aside className="sup-list">
          <div
            className="sup-filters"
            role="tablist"
            aria-label="Filter tickets"
            hidden={!tickets.length}
          >
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`sup-filter${filter === id ? ' on' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
                <span>{counts[id] || 0}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="sup-empty">Loading your tickets…</p>
          ) : shown.length === 0 ? (
            <div className="sup-empty">
              <Inbox size={22} strokeWidth={1.8} aria-hidden />
              <p>{filter === 'all' ? 'No tickets yet.' : 'Nothing with that status.'}</p>
            </div>
          ) : (
            <ul className="sup-threads">
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`sup-thread${selectedId === t.id ? ' on' : ''}`}
                    onClick={() => {
                      setSelectedId(t.id);
                      setComposing(false);
                    }}
                  >
                    <span className="sup-thread__top">
                      <span className={`sup-dot sup-dot--${t.status}`} aria-hidden />
                      <span className="sup-thread__s">{t.subject}</span>
                    </span>
                    <span className="sup-thread__m">
                      {categoryLabel(t.category)}
                      <span aria-hidden>·</span>
                      {statusLabel(t.status)}
                      <span aria-hidden>·</span>
                      {when(t.updatedAt || t.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ---------- the open thread, or a new one ---------- */}
        <section className="sup-pane">
          {composing ? (
            <form className="sup-compose" onSubmit={submitNew}>
              <div className="sup-pane__h">
                <button
                  type="button"
                  className="sup-back"
                  onClick={() => setComposing(false)}
                  aria-label="Back to tickets"
                >
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
                </button>
                <h2>New ticket</h2>
              </div>

              <fieldset className="ac-f">
                <legend>What is it about?</legend>
                <div className="sup-cats">
                  {TICKET_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`sup-cat${form.category === c.value ? ' on' : ''}`}
                      aria-pressed={form.category === c.value}
                      onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="ac-f">
                <span>Subject</span>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="One line on what went wrong"
                  required
                />
              </label>

              <label className="ac-f">
                <span>What happened?</span>
                <textarea
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="What you were doing, what you expected, and what happened instead."
                  required
                />
              </label>

              <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send ticket'}
              </button>
            </form>
          ) : selected ? (
            <>
              <div className="sup-pane__h">
                <button
                  type="button"
                  className="sup-back"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to tickets"
                >
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
                </button>
                <div className="sup-pane__t">
                  <h2>{selected.subject}</h2>
                  <p>
                    <span className={`sup-chip sup-chip--${selected.status}`}>
                      {statusLabel(selected.status)}
                    </span>
                    {categoryLabel(selected.category)}
                    <span aria-hidden>·</span>
                    Raised {when(selected.createdAt)}
                  </p>
                </div>
                <span className="sup-acts">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: selected.id,
                        subject: selected.subject,
                        category: selected.category,
                      })
                    }
                    aria-label="Edit ticket"
                  >
                    <Pencil size={15} strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTicket(selected.id)}
                    aria-label="Delete ticket"
                  >
                    <Trash2 size={15} strokeWidth={2} aria-hidden />
                  </button>
                </span>
              </div>

              {editing?.id === selected.id && (
                <form className="sup-edit" onSubmit={saveEdit}>
                  <label className="ac-f">
                    <span>Subject</span>
                    <input
                      value={editing.subject}
                      onChange={(e) => setEditing((p) => ({ ...p, subject: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="ac-f">
                    <span>Category</span>
                    <select
                      value={editing.category}
                      onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value }))}
                    >
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="sup-edit__a">
                    <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="ac-btn ac-btn--quiet"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <ol className="sup-msgs">
                {messages.map((m) => (
                  <li key={m.id} className={`sup-msg${m.senderRole === 'user' ? ' mine' : ''}`}>
                    <p className="sup-msg__w">
                      {m.senderRole === 'user' ? 'You' : m.senderName || 'Iron Lady'}
                      <span>{when(m.createdAt)}</span>
                    </p>
                    <p className="sup-msg__b">{m.text}</p>
                  </li>
                ))}
              </ol>

              <form className="sup-reply" onSubmit={sendReply}>
                <textarea
                  rows={2}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply…"
                  aria-label="Reply"
                />
                <button
                  type="submit"
                  className="ac-btn ac-btn--primary"
                  disabled={busy || !reply.trim()}
                  aria-label="Send reply"
                >
                  <Send size={15} strokeWidth={2.2} aria-hidden />
                </button>
              </form>
            </>
          ) : (
            <div className="sup-none">
              <Inbox size={26} strokeWidth={1.6} aria-hidden />
              <p>Pick a ticket to read it, or raise a new one.</p>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
