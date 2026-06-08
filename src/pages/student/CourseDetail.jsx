import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourse, getResources } from '../../services/courseService';
import { logUserActivity } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';

export default function CourseDetail() {
  const { courseId } = useParams();
  const { user, isGuest } = useAuth();
  const [course, setCourse] = useState(null);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    if (isGuest) return undefined;
    (async () => {
      const c = await getCourse(courseId);
      setCourse(c);
      const r = await getResources(courseId);
      setResources(r);
    })();
  }, [courseId, isGuest]);

  const trackView = async (resource) => {
    if (!user || isGuest) return;
    await logUserActivity(user.uid, {
      type: 'resource_view',
      courseId,
      title: resource.title,
      metadata: { resourceType: resource.type },
    });
  };

  if (isGuest) {
    return (
      <div className="page course-detail">
        <Link to="/app/home" className="back-link">
          ← Courses
        </Link>
        <GuestLockedPanel title="Course content locked" />
      </div>
    );
  }

  if (!course) return <p className="muted">Loading course…</p>;

  return (
    <div className="page course-detail mbw-program-page">
      <Link to="/app/home" className="back-link">
        ← Courses
      </Link>
      <h1>{course.title}</h1>
      <p className="page-sub">{course.code} — {course.description}</p>

      <section className="section">
        <h2>Resources</h2>
        <ul className="resource-list">
          {resources.map((r) => (
            <li key={r.id} className={`resource-item${r.locked ? ' resource-item--locked' : ''}`}>
              <div>
                <strong>{r.title}</strong>
                <span className="muted"> ({r.type})</span>
                {r.locked && <span className="badge badge-locked">Locked</span>}
              </div>
              {r.locked ? (
                <span className="resource-locked-label muted">Contact Iron Lady for access</span>
              ) : r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-primary"
                  onClick={() => trackView(r)}
                >
                  Open
                </a>
              ) : (
                <span className="muted">No URL</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
