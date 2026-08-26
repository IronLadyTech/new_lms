import { Link } from 'react-router-dom';
import EventPreviewCard from '../EventPreviewCard';
import EventDetailActions from '../EventDetailActions';
import HomeMiniCalendar from './HomeMiniCalendar';

/**
 * @param {object} props
 * @param {object[]} props.events — the next few sessions, listed
 * @param {object[]} [props.monthEvents] — every loaded event, for the month
 *   strip. Omit it and the strip is left out entirely rather than drawn empty.
 */
export default function HomeSchedulePanel({ events, monthEvents }) {
  return (
    <section className="dashboard-schedule" aria-labelledby="home-schedule-title">
      <div className="dashboard-panel__head">
        <h2 id="home-schedule-title" className="dashboard-panel__title">
          Schedule
        </h2>
        <Link to="/app/calendar" className="dashboard-panel__link">
          View calendar
        </Link>
      </div>

      {monthEvents && <HomeMiniCalendar events={monthEvents} />}

      {events.length === 0 ? (
        <p className="muted dashboard-schedule__empty">
          No live sessions scheduled — check back soon.
        </p>
      ) : (
        <ul className="dashboard-schedule__list">
          {events.slice(0, 4).map((ev) => (
            <li key={ev.id} className="dashboard-schedule__item">
              <EventPreviewCard event={ev} />
              <EventDetailActions event={ev} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
