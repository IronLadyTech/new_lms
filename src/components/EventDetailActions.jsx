import { CalendarPlus, ExternalLink } from 'lucide-react';
import { buildGoogleCalendarUrl, normalizeEventLink } from '../utils/eventLinks';

export default function EventDetailActions({ event, compact = false }) {
  const linkUrl = normalizeEventLink(event?.linkUrl);
  const googleUrl = buildGoogleCalendarUrl(event || {});

  return (
    <div className={`event-actions${compact ? ' event-actions--compact' : ''}`}>
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className="btn btn-outline btn-sm event-actions__btn"
      >
        <CalendarPlus size={14} strokeWidth={2} />
        Google Calendar
      </a>
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm event-actions__btn"
        >
          <ExternalLink size={14} strokeWidth={2} />
          Open link
        </a>
      )}
    </div>
  );
}
