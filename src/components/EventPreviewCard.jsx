import { Link } from 'react-router-dom';
import EventImage from './EventImage';

function formatEventType(type) {
  if (type === 'class') return 'Class';
  if (type === 'deadline') return 'Deadline';
  if (type === 'meeting') return 'Meeting';
  return 'General';
}

export function calendarEventUrl(event) {
  return `/app/calendar?date=${encodeURIComponent(event.date)}&event=${encodeURIComponent(event.id)}`;
}

export default function EventPreviewCard({ event, onClick }) {
  const meta = [
    event.date,
    event.time ? event.time.slice(0, 5) : null,
    formatEventType(event.type),
  ]
    .filter(Boolean)
    .join(' · ');

  const className = `event-preview-card${onClick ? ' event-preview-card--button' : ''}`;

  const inner = (
    <>
      <div className="event-preview-card__media">
        {event.imageUrl ? (
          <EventImage src={event.imageUrl} alt={event.title} className="event-preview-card__image" />
        ) : (
          <span className={`event-preview-card__placeholder event-preview-card__placeholder--${event.type || 'general'}`}>
            {formatEventType(event.type).slice(0, 1)}
          </span>
        )}
      </div>
      <div className="event-preview-card__body">
        <strong>{event.title}</strong>
        <span className="muted">{meta}</span>
        {event.description && <span className="event-preview-card__desc muted">{event.description}</span>}
      </div>
      {!onClick && (
        <span className="event-preview-card__chevron muted" aria-hidden>
          →
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return (
    <Link to={calendarEventUrl(event)} className={className}>
      {inner}
    </Link>
  );
}
