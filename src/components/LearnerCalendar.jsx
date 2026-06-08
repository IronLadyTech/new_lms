import { useEffect, useMemo, useState } from 'react';
import { eventsForDate, eventsForMonth } from '../services/eventService';
import EventImage from './EventImage';
import EventPreviewCard from './EventPreviewCard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_LEGEND = [
  { type: 'class', label: 'Class / Session' },
  { type: 'deadline', label: 'Deadline' },
  { type: 'meeting', label: 'Meeting' },
  { type: 'general', label: 'General event' },
];

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

export default function LearnerCalendar({ events, initialDate = '', focusEventId = '' }) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthEvents = useMemo(() => eventsForMonth(events, year, month), [events, year, month]);
  const eventsByDate = useMemo(() => groupByDate(monthEvents), [monthEvents]);
  const selectedEvents = useMemo(() => eventsForDate(events, selectedDate), [events, selectedDate]);
  const upcoming = useMemo(() => events.filter((e) => e.date >= todayStr).slice(0, 6), [events, todayStr]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const jumpToDate = (dateStr) => {
    const [y, m] = dateStr.split('-').map(Number);
    setViewDate(new Date(y, m - 1, 1));
    setSelectedDate(dateStr);
  };

  useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      jumpToDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (!focusEventId) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(`learner-event-${focusEventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
    return () => clearTimeout(timer);
  }, [focusEventId, selectedDate, selectedEvents]);

  const handleSelectDay = (day) => {
    if (!day) return;
    jumpToDate(toDateStr(year, month, day));
  };

  return (
    <div className="event-calendar learner-calendar">
      <div className="learner-calendar__legend">
        {EVENT_LEGEND.map(({ type, label }) => (
          <span key={type} className={`learner-calendar__legend-item learner-calendar__legend-item--${type}`}>
            {label}
          </span>
        ))}
      </div>

      {upcoming.length > 0 && (
        <section className="learner-calendar__upcoming">
          <h2>Upcoming events</h2>
          <ul className="learner-calendar__upcoming-list">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <EventPreviewCard event={ev} onClick={() => jumpToDate(ev.date)} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
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
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;

              return (
                <button
                  key={ds}
                  type="button"
                  className={`event-calendar__day event-calendar__day--rich${dayEvents.length ? ' has-events' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  <span className="event-calendar__day-num">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="event-calendar__day-events">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <span
                          key={ev.id}
                          className={`event-calendar__chip event-calendar__chip--${ev.type || 'general'}`}
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

        <aside className="event-calendar__sidebar learner-calendar__sidebar">
          <h3>{formatDisplayDate(selectedDate)}</h3>
          {selectedEvents.length === 0 ? (
            <p className="muted">No events on this day. Tap a highlighted date to see scheduled items.</p>
          ) : (
            <ul className="event-calendar__event-list">
              {selectedEvents.map((ev) => (
                <li
                  key={ev.id}
                  id={`learner-event-${ev.id}`}
                  className={`event-calendar__event-card event-calendar__event-card--${ev.type || 'general'}${focusEventId === ev.id ? ' is-focused' : ''}`}
                >
                  <EventImage src={ev.imageUrl} alt={ev.title} />
                  <div className="event-calendar__event-card-head">
                    <strong>{ev.title}</strong>
                    <span className={`badge badge-event badge-event--${ev.type || 'general'}`}>{formatEventType(ev.type)}</span>
                  </div>
                  {ev.time && <span className="event-calendar__event-time">{ev.time}</span>}
                  {ev.description && <p className="muted">{ev.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
