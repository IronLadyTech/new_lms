import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getResources,
  createResource,
  deleteResource,
} from '../../services/courseService';
import { getAllUsers } from '../../services/userService';

const RESOURCE_TYPES = ['video', 'pdf', 'ppt', 'assignment', 'mock_test'];

export default function AdminDashboard() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('courses');

  const [courseForm, setCourseForm] = useState({ title: '', code: '', description: '' });
  const [resourceForm, setResourceForm] = useState({
    courseId: '',
    title: '',
    type: 'video',
    url: '',
    description: '',
  });

  const load = async () => {
    setCourses(await getCourses());
    setResources(await getResources());
    setUsers(await getAllUsers());
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    await createCourse(courseForm);
    setCourseForm({ title: '', code: '', description: '' });
    load();
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    await createResource(resourceForm);
    setResourceForm({ courseId: '', title: '', type: 'video', url: '', description: '' });
    load();
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div>
          <h1>Admin dashboard</h1>
          <p>Course upload · resources · user tracking</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/app/home" className="btn btn-outline btn-sm">
            Student app
          </Link>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut().then(() => navigate('/auth/login'))}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        {['courses', 'resources', 'users'].map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {tab === 'courses' && (
          <section>
            <h2>Courses (CRUD)</h2>
            <form className="admin-form" onSubmit={handleCreateCourse}>
              <input
                placeholder="Title"
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                required
              />
              <input
                placeholder="Code (MBW / LEP)"
                value={courseForm.code}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                required
              />
              <input
                placeholder="Description"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Create course
              </button>
            </form>
            <ul className="admin-list">
              {courses.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.code}</strong> — {c.title}
                  </div>
                  <div className="admin-list__actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        updateCourse(c.id, {
                          description: prompt('New description', c.description) || c.description,
                        }).then(load)
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteCourse(c.id).then(load)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'resources' && (
          <section>
            <h2>Resources</h2>
            <p className="muted">Videos, assignments, PPT, mock tests, PDF — CloudFront / YouTube URLs</p>
            <form className="admin-form admin-form--grid" onSubmit={handleCreateResource}>
              <select
                value={resourceForm.courseId}
                onChange={(e) => setResourceForm({ ...resourceForm, courseId: e.target.value })}
                required
              >
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              <input
                placeholder="Title"
                value={resourceForm.title}
                onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                required
              />
              <select
                value={resourceForm.type}
                onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="URL (YouTube, CloudFront, PDF…)"
                value={resourceForm.url}
                onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Add resource
              </button>
            </form>
            <ul className="admin-list">
              {resources.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{r.title}</strong> <span className="muted">({r.type})</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => deleteResource(r.id).then(load)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'users' && (
          <section>
            <h2>User tracking</h2>
            <p className="muted">Users & activity — synced to Zoho in parallel</p>
            <ul className="admin-list">
              {users.map((u) => (
                <li key={u.id}>
                  <div>
                    <strong>{u.displayName}</strong>
                    <span className="muted"> {u.email}</span>
                    <span className="badge">{u.role}</span>
                  </div>
                  <span className="muted">
                    Enrolled: {(u.enrolledCourses || []).length} · Streak: {u.streak ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="admin-footer muted">Logged in as {profile?.email}</footer>
    </div>
  );
}
