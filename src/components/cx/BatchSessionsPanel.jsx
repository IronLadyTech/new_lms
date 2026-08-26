import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsForBatch,
} from '../../services/eventService';
import { normalizeEventLink } from '../../utils/eventLinks';
import EventDetailActions from '../EventDetailActions';
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

function formatWhen(ev) {
  const date = ev.date
    ? new Date(`${ev.date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const time = ev.time || '';
  const end = ev.endTime ? `–${ev.endTime}` : '';
  return `${date}${time ? ` · ${time}${end}` : ''}`;
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

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY, date: todayIso(), title: `${batch?.name || 'Batch'} live session` });
    setMsg('');
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

  const handleDelete = async (eventId) => {
    const ok = await confirm({
      title: 'Delete session',
      message: 'Remove this session from the batch calendar? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEvent(eventId);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
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
            Schedule live sessions for this cohort only ({participantCount} participants). CX
            moderators on this batch see them on their calendars; learners in the batch see them
            too. Use “Add to Google Calendar” on a session to block your external calendar.
          </p>
        </div>
        <div className="batch-sessions__actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setImportOpen((v) => !v);
              setFormOpen(false);
            }}
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

      {formOpen && (
        <form className="batch-sessions__form" onSubmit={handleSubmit}>
          <div className="batch-sessions__form-head">
            <h3>{editingId ? 'Edit session' : 'New session'}</h3>
            <button type="button" className="batch-sessions__icon-btn" onClick={closeForm}>
              <X size={18} aria-hidden />
              <span className="sr-only">Close</span>
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
      )}

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
          <div>
            <h3 className="batch-sessions__list-title">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="muted">Nothing upcoming.</p>
            ) : (
              <ul className="batch-sessions__list">
                {upcoming.map((ev) => (
                  <li key={ev.id} className="batch-sessions__item">
                    <div className="batch-sessions__item-main">
                      <span className="batch-sessions__badge" aria-hidden>
                        {ev.linkUrl ? <Video size={16} /> : <Clock size={16} />}
                      </span>
                      <div>
                        <strong>{ev.title}</strong>
                        <p className="muted">{formatWhen(ev)}</p>
                      </div>
                    </div>
                    <div className="batch-sessions__item-actions">
                      <EventDetailActions event={ev} />
                      <button
                        type="button"
                        className="batch-sessions__icon-btn"
                        onClick={() => openEdit(ev)}
                        aria-label={`Edit ${ev.title}`}
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="batch-sessions__icon-btn batch-sessions__icon-btn--danger"
                        onClick={() => handleDelete(ev.id)}
                        aria-label={`Delete ${ev.title}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h3 className="batch-sessions__list-title">Recent past</h3>
              <ul className="batch-sessions__list batch-sessions__list--past">
                {past.map((ev) => (
                  <li key={ev.id} className="batch-sessions__item">
                    <div className="batch-sessions__item-main">
                      <span className="batch-sessions__badge" aria-hidden>
                        <Link2 size={16} />
                      </span>
                      <div>
                        <strong>{ev.title}</strong>
                        <p className="muted">{formatWhen(ev)}</p>
                      </div>
                    </div>
                    <div className="batch-sessions__item-actions">
                      <button
                        type="button"
                        className="batch-sessions__icon-btn"
                        onClick={() => openEdit(ev)}
                        aria-label={`Edit ${ev.title}`}
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="batch-sessions__icon-btn batch-sessions__icon-btn--danger"
                        onClick={() => handleDelete(ev.id)}
                        aria-label={`Delete ${ev.title}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
