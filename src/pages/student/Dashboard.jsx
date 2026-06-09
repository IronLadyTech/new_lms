import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getUserActivities, syncUserStreak } from '../../services/userService';
import { getAssignments } from '../../services/courseService';
import { getEvents } from '../../services/eventService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../../services/announcementService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import AnnouncementFeed from '../../components/AnnouncementFeed';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseThumbnail from '../../components/CourseThumbnail';
import EventPreviewCard from '../../components/EventPreviewCard';
import EventDetailActions from '../../components/EventDetailActions';

export default function Dashboard() {
  const { user, profile, isGuest, refreshProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [activities, setActivities] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [streak, setStreak] = useState(profile?.streak ?? 0);

  useEffect(() => {
    setStreak(profile?.streak ?? 0);
  }, [profile?.streak]);

  useEffect(() => {
    if (!user || isGuest) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const synced = await syncUserStreak(user.uid);
        if (!cancelled) {
          setStreak(synced);
          await refreshProfile();
        }
      } catch (e) {
        console.error('Streak sync failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isGuest, refreshProfile]);

  useEffect(() => {
    if (!user || isGuest) return undefined;
    let cancelled = false;

    (async () => {
      const [allCourses, acts, events, allAnnouncements] = await Promise.all([
        getCourses(),
        getUserActivities(user.uid, 5),
        getEvents(),
        getAnnouncements(),
      ]);
      if (cancelled) return;

      setCourseMap(buildCourseMap(allCourses));
      const enrolled = allCourses.filter((c) => profile?.enrolledCourses?.includes(c.id));
      setCourses(enrolled);
      setActivities(acts);
      setAnnouncements(getActiveAnnouncementsForUser(allAnnouncements, user.uid));

      const today = new Date().toLocaleDateString('en-CA');
      setUpcomingEvents(events.filter((e) => e.date >= today).slice(0, 5));

      const assignmentLists = await Promise.all(
        enrolled.map((c) =>
          getAssignments(c.id).then((list) => list.map((a) => ({ ...a, courseTitle: c.title })))
        )
      );
      if (cancelled) return;
      setPendingAssignments(assignmentLists.flat().slice(0, 5));
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile?.enrolledCourses, isGuest]);

  if (isGuest) {
    return (
      <div className="page dashboard-page">
        <h1>Your dashboard</h1>
        <GuestLockedPanel title="Dashboard locked" />
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <h1>Your dashboard</h1>
      <p className="page-sub">
        Enrolled courses, activity & streak ·{' '}
        <Link to="/app/home">Browse all courses</Link>
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{courses.length}</span>
          <span className="stat-label">Enrolled</span>
        </div>
      </div>

      {courses.some((c) => c.code === 'MBW') && (
        <section className="section mbw-dash-card">
          <h2>MBW Pre-Session Tasks</h2>
          <p className="mbw-dash-card__text">
            Continue your Iron Lady MBW journey — complete tasks in order and track your progress.
          </p>
          <Link to="/app/mbw" className="btn btn-primary btn-sm">
            Open MBW tasks →
          </Link>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="section announcement-section">
          <h2>Announcements</h2>
          <AnnouncementFeed announcements={announcements} userId={user.uid} />
        </section>
      )}

      <section className="section">
        <h2>
          Enrolled courses · <Link to="/app/home">View all courses</Link>
        </h2>
        {courses.length === 0 ? (
          <p className="muted">
            No enrollments yet. <Link to="/app/home">Browse courses</Link>
          </p>
        ) : (
          <ul className="list-cards list-cards--courses">
            {courses.map((c) => (
              <li key={c.id} className="list-cards__course">
                <CourseThumbnail course={c} size="sm" />
                {c.code === 'MBW' ? (
                  <Link to="/app/mbw" className="list-cards__course-link">
                    <strong>{c.code}</strong> — {c.title}
                  </Link>
                ) : (
                  <Link to={`/app/course/${c.id}`} className="list-cards__course-link">
                    <strong>{c.code}</strong> — {c.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Last activity</h2>
        {activities.length === 0 ? (
          <p className="muted">No activity yet. Start a lesson!</p>
        ) : (
          <ActivityLogList activities={activities} courseMap={courseMap} />
        )}
      </section>

      <section className="section">
        <h2>
          Upcoming events · <Link to="/app/calendar">View calendar</Link>
        </h2>
        {upcomingEvents.length === 0 ? (
          <p className="muted">No upcoming events scheduled.</p>
        ) : (
          <ul className="list-cards list-cards--events">
            {upcomingEvents.map((ev) => (
              <li key={ev.id} className="event-preview-list__item">
                <EventPreviewCard event={ev} />
                <EventDetailActions event={ev} compact />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Pending assignments</h2>
        {pendingAssignments.length === 0 ? (
          <p className="muted">All caught up!</p>
        ) : (
          <ul className="list-cards">
            {pendingAssignments.map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <span className="muted"> — {a.courseTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
