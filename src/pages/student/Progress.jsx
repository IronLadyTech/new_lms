import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getResources } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';

const RESOURCE_ICONS = {
  video: '🎬',
  pdf: '📄',
  ppt: '📊',
  assignment: '📝',
  mock_test: '✅',
};

export default function Progress() {
  const { user, profile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (!user || isGuest) return undefined;
    (async () => {
      const all = await getCourses();
      const enrolled = all.filter((c) => profile?.enrolledCourses?.includes(c.id));
      setCourses(enrolled);

      const res = [];
      for (const c of enrolled) {
        const r = await getResources(c.id);
        res.push(...r.map((item) => ({ ...item, courseTitle: c.title })));
      }
      setResources(res);

      const acts = await getUserActivities(user.uid, 30);
      setActivities(acts);
    })();
  }, [user, profile, isGuest]);

  if (isGuest) {
    return (
      <div className="page progress-page">
        <h1>Course tracking</h1>
        <GuestLockedPanel title="Progress locked" />
      </div>
    );
  }

  return (
    <div className="page progress-page">
      <h1>Course tracking</h1>
      <p className="page-sub">All activity — videos, PPT, PDF, mock tests</p>

      {courses.some((c) => c.code === 'MBW') && (
        <section className="section mbw-dash-card">
          <h2>MBW Pre-Session Tasks</h2>
          <p className="mbw-dash-card__text">Track and complete your Iron Lady MBW pre-session work.</p>
          <Link to="/app/mbw" className="btn btn-primary btn-sm">
            Open MBW tasks →
          </Link>
        </section>
      )}

      <section className="section">
        <h2>Resources</h2>
        {resources.length === 0 ? (
          <p className="muted">No resources published yet.</p>
        ) : (
          <ul className="resource-list">
            {resources.map((r) => (
              <li key={r.id} className={`resource-item${r.locked ? ' resource-item--locked' : ''}`}>
                <span>{RESOURCE_ICONS[r.type] || '📁'}</span>
                <div>
                  <strong>{r.title}</strong>
                  <span className="muted">
                    {r.type} · {r.courseTitle}
                  </span>
                  {r.locked && <span className="badge badge-locked">Locked</span>}
                </div>
                {r.locked ? (
                  <span className="resource-locked-label muted">Locked</span>
                ) : r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Activity log</h2>
        <ul className="activity-list">
          {activities.map((a) => (
            <li key={a.id}>
              <span className="activity-type">{a.type}</span>
              <span>{a.title}</span>
              {a.courseId && <span className="muted"> · {a.courseId}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
