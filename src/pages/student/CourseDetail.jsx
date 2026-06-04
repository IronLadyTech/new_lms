import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourse, getResources } from '../../services/courseService';
import { logUserActivity } from '../../services/userService';
import { logActivityToZoho } from '../../services/zohoService';

export default function CourseDetail() {
  const { courseId } = useParams();
  const { user, profile } = useAuth();
  const [course, setCourse] = useState(null);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    (async () => {
      const c = await getCourse(courseId);
      setCourse(c);
      const r = await getResources(courseId);
      setResources(r);
    })();
  }, [courseId]);

  const trackView = async (resource) => {
    if (!user) return;
    await logUserActivity(user.uid, {
      type: 'resource_view',
      courseId,
      title: resource.title,
      metadata: { resourceType: resource.type },
    });
    logActivityToZoho({
      email: profile?.email || user.email,
      activityType: 'resource_view',
      courseId,
      metadata: { title: resource.title },
    }).catch(() => {});
  };

  if (!course) return <p className="muted">Loading course…</p>;

  return (
    <div className="page course-detail">
      <Link to="/app/home" className="back-link">
        ← Courses
      </Link>
      <h1>{course.title}</h1>
      <p className="page-sub">{course.code} — {course.description}</p>

      <section className="section">
        <h2>Resources</h2>
        <ul className="resource-list">
          {resources.map((r) => (
            <li key={r.id} className="resource-item">
              <div>
                <strong>{r.title}</strong>
                <span className="muted"> ({r.type})</span>
              </div>
              {r.url ? (
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
