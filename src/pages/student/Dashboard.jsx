import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import { getAssignments } from '../../services/courseService';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const allCourses = await getCourses();
      const enrolled = allCourses.filter((c) => profile?.enrolledCourses?.includes(c.id));
      setCourses(enrolled);

      const acts = await getUserActivities(user.uid, 5);
      setActivities(acts);

      const pending = [];
      for (const c of enrolled) {
        const assignments = await getAssignments(c.id);
        pending.push(...assignments.map((a) => ({ ...a, courseTitle: c.title })));
      }
      setPendingAssignments(pending.slice(0, 5));
    })();
  }, [user, profile]);

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
