import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEvents } from '../../services/eventService';
import LearnerCalendar from '../../components/LearnerCalendar';
import GuestLockedPanel from '../../components/GuestLockedPanel';

export default function CalendarPage() {
  const { isGuest } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return undefined;
    }
    getEvents()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isGuest]);

  if (isGuest) {
    return (
      <div className="page calendar-page">
        <h1>Calendar</h1>
        <GuestLockedPanel title="Calendar locked" />
      </div>
    );
  }

  return (
    <div className="page calendar-page">
      <h1>Calendar</h1>
      <p className="page-sub">Classes, deadlines, and events from Iron Lady.</p>
      {loading ? <p className="muted">Loading calendar…</p> : <LearnerCalendar events={events} />}
    </div>
  );
}
