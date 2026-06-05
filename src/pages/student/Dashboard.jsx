import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import { getAssignments } from '../../services/courseService';
import { getEvents } from '../../services/eventService';
import GuestLockedPanel from '../../components/GuestLockedPanel';

export default function Dashboard() {
  const { user, profile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    if (!user || isGuest) return undefined;
    let cancelled = false;

    (async () => {
      // Kick off independent reads in parallel instead of awaiting one by one.
      const [allCourses, acts, events] = await Promise.all([
        getCourses(),
        getUserActivities(user.uid, 5),
        getEvents(),
      ]);
      if (cancelled) return;

      const enrolled = allCourses.filter((c) => profile?.enrolledCourses?.includes(c.id));
      setCourses(enrolled);
      setActivities(acts);

      const today = new Date().toISOString().slice(0, 10);
      setUpcomingEvents(events.filter((e) => e.date >= today).slice(0, 5));

      // Fetch all enrolled-course assignments concurrently (avoids N+1 waterfall).
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
  }, [user, profile, isGuest]);

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
          <span className="stat-value">{profile?.streak ?? 0}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{courses.length}</span>
          <span className="stat-label">Enrolled</span>
        </div>
      </div>

      <section className="section">
        <h2>Enrolled courses</h2>
        {courses.length === 0 ? (
          <p className="muted">
            No enrollments yet. <Link to="/app/home">Browse courses</Link>
          </p>
        ) : (
          <ul className="list-cards">
            {courses.map((c) => (
              <li key={c.id}>
                <Link to={`/app/course/${c.id}`}>
                  <strong>{c.code}</strong> — {c.title}
                </Link>
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
          <ul className="activity-list">
            {activities.map((a) => (
              <li key={a.id}>
                <span className="activity-type">{a.type}</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>
          Upcoming events · <Link to="/app/calendar">View calendar</Link>
        </h2>
        {upcomingEvents.length === 0 ? (
          <p className="muted">No upcoming events scheduled.</p>
        ) : (
          <ul className="list-cards">
            {upcomingEvents.map((ev) => (
              <li key={ev.id}>
                <strong>{ev.date}</strong>
                {ev.time && ` · ${ev.time}`} — {ev.title}
                <span className="badge">{ev.type}</span>
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
