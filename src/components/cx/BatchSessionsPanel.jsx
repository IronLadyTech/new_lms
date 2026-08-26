import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsForBatch,
} from '../../services/eventService';
import { buildGoogleCalendarUrl, normalizeEventLink } from '../../utils/eventLinks';
import ConfirmDialog from '../ConfirmDialog';
import ScheduleImport from './ScheduleImport';
import { useConfirm } from '../../hooks/useConfirm';

const EMPTY = {
  title: '',
  description: '',
  date: '',
  time: '10:00',
  endTime: '12:00',
  type: 'class',
  linkUrl: '',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The date split into its own parts so a column of sessions lines up: weekday,
 * day and month each get a fixed slot rather than one run-on string.
 */
function dateParts(iso) {
  if (!iso) return { dow: '--', day: '', mon: '' };
  const d = new Date(`${iso}T12:00:00`);
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    mon: d.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function timeRange(ev) {
  if (!ev.time) return 'Time not set';
  return ev.endTime ? `${ev.time} – ${ev.endTime}` : ev.time;
}

/** "2026-08" -> "August 2026", for the month headings in a long schedule. */
function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/*
 * A term's schedule is twenty-odd sessions. As one unbroken list there is no
 * way to find "the one in October" without reading every row, so the list is
 * cut at each month boundary and each run gets a heading.
 */
function groupByMonth(list) {
  const groups = [];
  list.forEach((ev) => {
    const key = String(ev.date || '').slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(ev);
    else groups.push({ key, items: [ev] });
  });
  return groups;
}

/**
 * CX-only: create / edit / delete calendar sessions for one batch.
 * Sessions appear on learner + CX calendars scoped to this batch and can be
 * added to Google Calendar (blocks external calendars).
 */
export default function BatchSessionsPanel({ batch, userId }) {
  const { confirm, dialogProps } = useConfirm();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, date: todayIso() });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const participantCount = (batch?.memberIds || []).length;

  /*
   * The deck writes dates without a year. The batch's existing sessions are the
   * best evidence of which year it is running in; with none yet, this year is
   * the only sensible guess and CX can correct any row afterwards.
   */
  const importYear = useMemo(() => {
    const dates = events
      .map((e) => e.date)
      .filter(Boolean)
      .sort();
    return dates.length ? Number(dates[0].slice(0, 4)) : new Date().getFullYear();
  }, [events]);

  const load = useCallback(async () => {
    if (!batch?.id) return;
    setLoading(true);
    setError('');
    try {
      const list = await getEventsForBatch(batch.id);
      setEvents(list);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, [batch?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => {
    const today = todayIso();
    return events.filter((e) => (e.date || '') >= today);
  }, [events]);

  const past = useMemo(() => {
    const today = todayIso();
    return events
      .filter((e) => (e.date || '') < today)
      .slice(-5)
      .reverse();
  }, [events]);

  const upcomingMonths = useMemo(() => groupByMonth(upcoming), [upcoming]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY, date: todayIso(), title: `${batch?.name || 'Batch'} live session` });
    setMsg('');
    setImportOpen(false);
    setFormOpen(true);
  };

  const openEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date || todayIso(),
      time: ev.time || '10:00',
      endTime: ev.endTime || '',
      type: ev.type || 'class',
      linkUrl: ev.linkUrl || '',
    });
    setMsg('');
    setImportOpen(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batch?.id) return;
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date,
        time: form.time,
        endTime: form.endTime || '',
        type: form.type || 'class',
        linkUrl: normalizeEventLink(form.linkUrl),
        batchId: batch.id,
        batchName: batch.name || '',
        audience: 'batch',
        blocksStaff: true,
        createdBy: userId,
      };
      if (editingId) {
        const { createdBy, ...updatePayload } = payload;
        await updateEvent(editingId, updatePayload);
        setMsg('Session updated — calendars for this batch will refresh.');
      } else {
        await createEvent(payload);
        setMsg('Session added — it now appears on this batch’s calendars.');
      }
      closeForm();
      await load();
    } catch (err) {
      setMsg(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  /*
   * Created one at a time on purpose. A batched write would be faster, but if
   * the tenth of twenty-six failed there would be no way to tell CX which ones
   * landed. Sequential means the error names the session it stopped on, and
   * re-importing skips whatever already went in.
   */
  const handleImport = async (sessions) => {
    for (const s of sessions) {
      await createEvent({
        title: s.title,
        description: s.description,
        date: s.date,
        time: s.time,
        endTime: s.endTime || '',
        type: s.type || 'class',
        linkUrl: '',
        batchId: batch.id,
        batchName: batch.name || '',
        audience: 'batch',
        blocksStaff: true,
        createdBy: userId,
      });
    }
    await load();
  };

  const handleDelete = async (ev) => {
    const ok = await confirm({
      title: 'Delete session',
      /*
       * Names the session. "Remove this session" left CX confirming a row they
       * could no longer see behind the dialog.
       */
      message: `Remove “${ev.title}” from the ${
        batch?.name || 'batch'
      } calendar? Learners in this batch will no longer see it. This cannot be undone.`,
      confirmLabel: 'Delete session',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEvent(ev.id);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  /*
   * One form, rendered in one of two places: above the list when adding, and
   * inside the row being changed when editing. It previously always opened at
   * the top of the panel, so editing the last of twenty-three sessions scrolled
   * CX away from the row and gave no sign of which one they had opened.
   */
  const sessionForm = (
    <form className="batch-sessions__form" onSubmit={handleSubmit}>
      <div className="batch-sessions__form-head">
        <h3>{editingId ? 'Edit session' : 'New session'}</h3>
        <button
          type="button"
          className="batch-sessions__icon-btn"
          onClick={closeForm}
          aria-label="Close without saving"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </label>

      <div className="batch-sessions__row">
        <label className="field">
          <span className="field-label">Date</span>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field-label">Start</span>
          <input
            type="time"
            required
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field-label">End</span>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Join link (Zoom / Meet)</span>
        <input
          type="url"
          placeholder="https://"
          value={form.linkUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
        />
      </label>

      <label className="field">
        <span className="field-label">Notes</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>

      <p className="batch-sessions__scope muted">
        <Users size={14} aria-hidden /> Scoped to <strong>{batch.name}</strong> only — other
        batches will not see this session.
      </p>

      {msg && (
        <div className="alert alert-error" role="alert">
          {msg}
        </div>
      )}

      <div className="batch-sessions__form-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={closeForm}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to calendar'}
        </button>
      </div>
    </form>
  );

  const renderSession = (ev, { isPast = false } = {}) => {
    const { dow, day, mon } = dateParts(ev.date);
    const editing = formOpen && editingId === ev.id;
    const link = normalizeEventLink(ev.linkUrl);

    return (
      <li
        key={ev.id}
        className={`batch-sessions__item${editing ? ' batch-sessions__item--editing' : ''}`}
      >
        <div className="batch-sessions__row-main">
          {/*
            The visible date is decoration for a screen reader — the row's
            accessible names already carry the title, and the form beneath
            repeats the date in a real input.
          */}
          <div className="batch-sessions__when" aria-hidden>
            <span className="batch-sessions__dow">{dow}</span>
            <span className="batch-sessions__day">{day}</span>
            <span className="batch-sessions__mon">{mon}</span>
          </div>

          <div className="batch-sessions__body">
            <p className="batch-sessions__name">{ev.title}</p>
            <p className="batch-sessions__meta">
              <span className="batch-sessions__time">{timeRange(ev)}</span>
              {link && (
                <span className="batch-sessions__tag">
                  <ExternalLink size={12} aria-hidden />
                  Join link set
                </span>
              )}
            </p>
          </div>

          {/*
            Three quiet actions of equal weight. "Add to Google Calendar" used
            to be a full-width button on every row, which made the one action
            CX rarely needs the loudest thing in a panel built for editing.
          */}
          <div className="batch-sessions__row-actions">
            {!isPast && (
              <a
                className="batch-sessions__icon-btn"
                href={buildGoogleCalendarUrl(ev)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Add ${ev.title} to Google Calendar`}
                title="Add to Google Calendar"
              >
                <CalendarPlus size={16} aria-hidden />
              </a>
            )}
            <button
              type="button"
              className="batch-sessions__icon-btn"
              onClick={() => (editing ? closeForm() : openEdit(ev))}
              aria-expanded={editing}
              aria-label={`Edit ${ev.title}`}
              title="Edit"
            >
              <Pencil size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="batch-sessions__icon-btn batch-sessions__icon-btn--danger"
              onClick={() => handleDelete(ev)}
              aria-label={`Delete ${ev.title}`}
              title="Delete"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </div>

        {editing && sessionForm}
      </li>
    );
  };

  if (!batch?.id) return null;

  return (
    <section className="cx-section batch-sessions" aria-labelledby="batch-sessions-title">
      <ConfirmDialog {...dialogProps} />

      <div className="batch-sessions__head">
        <div>
          <h2 id="batch-sessions-title" className="batch-sessions__title">
            <CalendarDays size={20} aria-hidden />
            Batch calendar sessions
          </h2>
          <p className="batch-sessions__sub muted">
            Live sessions for this cohort only — {participantCount} participant
            {participantCount === 1 ? '' : 's'} and the CX moderators on this batch see them.
          </p>
        </div>
        <div className="batch-sessions__actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setImportOpen((v) => !v);
              closeForm();
            }}
            aria-expanded={importOpen}
          >
            <Upload size={16} aria-hidden />
            Import schedule
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            Add session
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {msg && !formOpen && (
        <div className="alert alert-success" role="status">
          {msg}
        </div>
      )}

      {importOpen && (
        <ScheduleImport
          startYear={importYear}
          existingEvents={events}
          onImport={handleImport}
          onClose={() => setImportOpen(false)}
        />
      )}

      {/* Only a new session opens here; an edit opens inside its own row. */}
      {formOpen && !editingId && sessionForm}

      {loading ? (
        <p className="muted">Loading sessions…</p>
      ) : events.length === 0 ? (
        <div className="batch-sessions__empty">
          <CalendarDays size={28} aria-hidden />
          <p>No sessions scheduled for this batch yet.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={openCreate}>
            Schedule the first session
          </button>
        </div>
      ) : (
        <div className="batch-sessions__lists">
          <div className="batch-sessions__group">
            <h3 className="batch-sessions__list-title">
              Upcoming
              <span className="batch-sessions__count">{upcoming.length}</span>
            </h3>
            {upcoming.length === 0 ? (
              <p className="muted">Nothing upcoming.</p>
            ) : (
              upcomingMonths.map((group) => (
                <div key={group.key} className="batch-sessions__month">
                  <h4 className="batch-sessions__month-title">{monthLabel(group.key)}</h4>
                  <ul className="batch-sessions__list">
                    {group.items.map((ev) => renderSession(ev))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {past.length > 0 && (
            <div className="batch-sessions__group">
              <h3 className="batch-sessions__list-title">
                Recent past
                <span className="batch-sessions__count">{past.length}</span>
              </h3>
              <ul className="batch-sessions__list batch-sessions__list--past">
                {past.map((ev) => renderSession(ev, { isPast: true }))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
