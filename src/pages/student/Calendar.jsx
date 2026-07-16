import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarX, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEvents } from '../../services/eventService';
import LearnerCalendar from '../../components/LearnerCalendar';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

export default function CalendarPage() {
  const { isGuest } = useAuth();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const initialDate = searchParams.get('date') || '';
  const focusEventId = searchParams.get('event') || '';

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getEvents()
      .then(setEvents)
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    load();
  }, [isGuest, load]);

  const header = (
    <PageHeader
      eyebrow="Schedule"
      icon={CalendarDays}
      title="Calendar"
      subtitle="Classes, deadlines, and events from Iron Lady."
    />
  );

  if (isGuest) {
    return (
      <div className="page calendar-page">
        {header}
        <GuestLockedPanel title="Calendar locked" />
      </div>
    );
  }

  return (
    <div className="page calendar-page">
      {header}
      {loading ? (
        <div className="dashboard-skeleton dashboard-skeleton--inline" aria-busy="true">
          <div className="dashboard-skeleton__block" style={{ minHeight: '20rem' }} />
        </div>
      ) : error ? (
        <EmptyState
          icon={CalendarX}
          title="Couldn't load your calendar"
          message="Something went wrong fetching your events. Please try again."
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              <RefreshCw size={16} aria-hidden="true" />
              Retry
            </button>
          }
        />
      ) : (
        <LearnerCalendar events={events} initialDate={initialDate} focusEventId={focusEventId} />
      )}
    </div>
  );
}
