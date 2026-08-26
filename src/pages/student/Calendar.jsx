import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarX, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEvents } from '../../services/eventService';
import { getGroupsByProgram } from '../../services/groupService';
import { filterEventsForLearner, filterEventsForStaff } from '../../utils/eventVisibility';
import { PROGRAMS } from '../../data/programTypes';
import LearnerCalendar from '../../components/LearnerCalendar';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

export default function CalendarPage() {
  const { user, profile, isGuest, role } = useAuth();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [moderatedBatchIds, setModeratedBatchIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const initialDate = searchParams.get('date') || '';
  const focusEventId = searchParams.get('event') || '';

  const isStaff = role === 'moderator' || role === 'admin' || role === 'superadmin';
  const isFullAdmin = role === 'admin' || role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await getEvents();
      setEvents(list);

      if (isStaff && user?.uid) {
        const program = profile?.program || PROGRAMS.MBW;
        const groups = await getGroupsByProgram(program);
        if (isFullAdmin) {
          setModeratedBatchIds(groups.map((g) => g.id));
        } else {
          setModeratedBatchIds(
            groups
              .filter(
                (g) => (g.moderatorIds || []).includes(user.uid) || g.createdBy === user.uid
              )
              .map((g) => g.id)
          );
        }
      } else {
        setModeratedBatchIds([]);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isStaff, isFullAdmin, user?.uid, profile?.program]);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    load();
  }, [isGuest, load]);

  const visibleEvents = useMemo(() => {
    if (isStaff) {
      return filterEventsForStaff(events, { moderatedBatchIds });
    }
    return filterEventsForLearner(events, { batchId: profile?.batchId || '' });
  }, [events, isStaff, moderatedBatchIds, profile?.batchId]);

  const header = (
    <PageHeader
      eyebrow="Schedule"
      icon={CalendarDays}
      title="Calendar"
      subtitle={
        isStaff
          ? 'Your batch sessions and Iron Lady events — add a session to Google Calendar to block your day.'
          : 'Classes and deadlines for your cohort, plus Iron Lady events.'
      }
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
        <LearnerCalendar
          events={visibleEvents}
          initialDate={initialDate}
          focusEventId={focusEventId}
        />
      )}
    </div>
  );
}
