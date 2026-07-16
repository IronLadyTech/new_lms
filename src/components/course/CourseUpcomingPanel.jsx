import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { calendarEventUrl } from '../EventPreviewCard';

/**
 * Behance-inspired "Upcoming webinars" sidebar card for the course page.
 * Shows real events with BOTH absolute ("6 Feb · 19:00") and relative
 * ("In 11 days") time — the reference's signature time treatment.
 * Renders nothing when there are no upcoming events.
 */
function parts(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  return { y, m, d };
}

function relativeLabel(dateStr) {
  if (!dateStr) return '';
  const { y, m, d } = parts(dateStr);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(y, m - 1, d);
  const dayDiff = Math.round((startTarget - startToday) / 86400000);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff < 7) return `In ${dayDiff} days`;
  const weeks = Math.floor(dayDiff / 7);
  return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
}

function absoluteLabel(dateStr, timeStr) {
  if (!dateStr) return '';
  const { y, m, d } = parts(dateStr);
  const datePart = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return timeStr ? `${datePart} · ${timeStr.slice(0, 5)}` : datePart;
}

export default function CourseUpcomingPanel({ events = [] }) {
  if (!events.length) return null;

  return (
    <section className="course-upcoming" aria-labelledby="course-upcoming-title">
      <div className="course-upcoming__head">
        <h2 id="course-upcoming-title" className="course-upcoming__title">
          <CalendarClock size={16} aria-hidden="true" />
          Upcoming
        </h2>
        <Link to="/app/calendar" className="dashboard-panel__link">
          View all
        </Link>
      </div>
      <ul className="course-upcoming__list">
        {events.map((ev) => {
          const rel = relativeLabel(ev.date);
          return (
            <li key={ev.id} className="course-upcoming__item">
              <Link to={calendarEventUrl(ev)} className="course-upcoming__link">
                <span className="course-upcoming__name">{ev.title}</span>
                <span className="course-upcoming__when muted">
                  {absoluteLabel(ev.date, ev.time)}
                </span>
              </Link>
              {rel && <span className="course-upcoming__chip">{rel}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
