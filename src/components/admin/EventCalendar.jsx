import { useMemo, useState } from 'react';
import { createEvent, updateEvent, deleteEvent, eventsForDate, eventsForMonth } from '../../services/eventService';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'class', label: 'Class / Session' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'meeting', label: 'Meeting' },
];
const EVENT_LEGEND = [
  { type: 'class', label: 'Class / Session' },
  { type: 'deadline', label: 'Deadline' },
  { type: 'meeting', label: 'Meeting' },
  { type: 'general', label: 'General event' },
];

const EMPTY_FORM = { title: '', description: '', date: '', time: '09:00', type: 'general' };

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function formatEventType(type) {
  if (type === 'class') return 'Class';
  if (type === 'deadline') return 'Deadline';
  if (type === 'meeting') return 'Meeting';
  return 'Event';
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByDate(eventList) {
  return eventList.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});
}

function eventToForm(ev) {
  return {
    title: ev.title || '',
    description: ev.description || '',
    date: ev.date || '',
    time: ev.time || '09:00',
    type: ev.type || 'general',
  };
}

export default function EventCalendar({ events, onRefresh, createdBy }) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: todayStr });
  const [editingEventId, setEditingEventId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthEvents = useMemo(() => eventsForMonth(events, year, month), [events, year, month]);
  const eventsByDate = useMemo(() => groupByDate(monthEvents), [monthEvents]);
  const selectedEvents = useMemo(() => eventsForDate(events, selectedDate), [events, selectedDate]);
  const upcoming = useMemo(() => events.filter((e) => e.date >= todayStr).slice(0, 10), [events, todayStr]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const resetForm = (dateStr = selectedDate) => {
    setForm({ ...EMPTY_FORM, date: dateStr });
    setEditingEventId(null);
  };

  const jumpToDate = (dateStr) => {
    const [y, m] = dateStr.split('-').map(Number);
    setViewDate(new Date(y, m - 1, 1));
    setSelectedDate(dateStr);
    if (!editingEventId) setForm((f) => ({ ...f, date: dateStr }));
  };

  const handleSelectDay = (day) => {
    if (!day) return;
    const ds = toDateStr(year, month, day);
    setSelectedDate(ds);
    if (!editingEventId) setForm((f) => ({ ...f, date: ds }));
  };

  const startEditEvent = (ev) => {
    const [y, m] = ev.date.split('-').map(Number);
    setEditingEventId(ev.id);
    setForm(eventToForm(ev));
    setViewDate(new Date(y, m - 1, 1));
    setSelectedDate(ev.date);
    setMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editingEventId) {
        await updateEvent(editingEventId, {
          title: form.title,
          description: form.description,
          date: form.date,
          time: form.time,
          type: form.type,
        });
        setMsg('Event updated.');
        if (form.date !== selectedDate) jumpToDate(form.date);
      } else {
        await createEvent({ ...form, createdBy });
        setMsg('Event added.');
      }
      resetForm(form.date);
      onRefresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    setMsg('');
    try {
      await deleteEvent(eventId);
      if (editingEventId === eventId) resetForm();
      setMsg('Event deleted.');
      onRefresh();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const isSuccessMsg = msg.includes('added') || msg.includes('updated') || msg.includes('deleted');

  return (
    <div className="event-calendar admin-calendar">
      <div className="learner-calendar__legend">
        {EVENT_LEGEND.map(({ type, label }) => (
          <span key={type} className={`learner-calendar__legend-item learner-calendar__legend-item--${type}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="event-calendar__layout">
        <div className="event-calendar__grid-wrap">
          <div className="event-calendar__nav">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              ←
            </button>
            <div className="learner-calendar__month-head">
              <strong>{monthLabel}</strong>
              <span className="muted">{monthEvents.length} event{monthEvents.length === 1 ? '' : 's'} this month</span>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              →
            </button>
          </div>

          <div className="event-calendar__weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="event-calendar__grid event-calendar__grid--rich">
            {calendarDays.map((day, i) => {
              if (!day) {
                return (
                  <span
                    key={`empty-${i}`}
                    className="event-calendar__day event-calendar__day--rich event-calendar__day--empty"
                    aria-hidden
                  />
                );
              }

              const ds = toDateStr(year, month, day);
              const dayEvents = eventsByDate[ds] || [];
              const isSelected = ds === selectedDate;
              const isToday = ds === todayStr;

              return (
                <button
                  key={ds}
                  type="button"
                  className={`event-calendar__day event-calendar__day--rich${dayEvents.length ? ' has-events' : ''}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  <span className="event-calendar__day-num">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="event-calendar__day-events">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <span
                          key={ev.id}
                          className={`event-calendar__chip event-calendar__chip--${ev.type || 'general'}${editingEventId === ev.id ? ' is-editing' : ''}`}
                          title={`${ev.time ? `${ev.time} · ` : ''}${ev.title}`}
                        >
                          {ev.time && <span className="event-calendar__chip-time">{ev.time.slice(0, 5)}</span>}
                          <span className="event-calendar__chip-title">{ev.title}</span>
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="event-calendar__chip event-calendar__chip--more">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="event-calendar__sidebar admin-calendar__sidebar">
          <h3>{formatDisplayDate(selectedDate)}</h3>

          {selectedEvents.length === 0 ? (
            <p className="muted">No events on this day. Select a date or add one below.</p>
          ) : (
            <ul className="event-calendar__event-list admin-calendar__event-list">
              {selectedEvents.map((ev) => (
                <li key={ev.id} className={`event-calendar__event-card event-calendar__event-card--${ev.type || 'general'}${editingEventId === ev.id ? ' is-editing' : ''}`}>
                  <div className="event-calendar__event-card-head">
                    <strong>{ev.title}</strong>
                    <span className={`badge badge-event badge-event--${ev.type || 'general'}`}>{formatEventType(ev.type)}</span>
                  </div>
                  {ev.time && <span className="event-calendar__event-time">{ev.time}</span>}
                  {ev.description && <p className="muted">{ev.description}</p>}
                  <div className="admin-list__actions">
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => startEditEvent(ev)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(ev.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="admin-card admin-calendar__form-card">
            <h4>{editingEventId ? 'Edit event' : `Add event on ${selectedDate}`}</h4>
            {msg && <p className={isSuccessMsg ? 'success-text' : 'alert alert-error'}>{msg}</p>}
            <form className="admin-form admin-form--stacked" onSubmit={handleSubmit}>
              <input
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
              <div className="admin-card__actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : editingEventId ? 'Save changes' : '+ Add event'}
                </button>
                {editingEventId && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => resetForm()}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </aside>
      </div>

      <section className="event-calendar__upcoming admin-calendar__upcoming">
        <h3>All upcoming events</h3>
        {upcoming.length === 0 ? (
          <p className="muted">No upcoming events scheduled.</p>
        ) : (
          <ul className="admin-list admin-calendar__upcoming-list">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <div className="admin-calendar__upcoming-row">
                  <button type="button" className="learner-calendar__upcoming-item admin-calendar__upcoming-main" onClick={() => jumpToDate(ev.date)}>
                    <span className={`learner-calendar__type-dot learner-calendar__type-dot--${ev.type || 'general'}`} />
                    <span className="learner-calendar__date">{ev.date}</span>
                    <span>
                      <strong>{ev.title}</strong>
                      <span className="muted">
                        {ev.time ? `${ev.time} · ` : ''}
                        {formatEventType(ev.type)}
                      </span>
                    </span>
                  </button>
                  <div className="admin-list__actions">
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => startEditEvent(ev)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(ev.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
