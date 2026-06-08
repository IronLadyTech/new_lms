import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getResources,
  createResource,
  updateResource,
  deleteResource,
  setResourceLocked,
} from '../../services/courseService';
import {
  getAllUsers,
  getAllActivities,
  assignAdminRole,
  setUserBlocked,
  getUserActivities,
} from '../../services/userService';
import { uploadResourceFile, uploadCourseAsset, resourceTypeFromFile } from '../../services/storageService';
import {
  getGroups,
  createGroup,
  deleteGroup,
  addMemberToGroup,
  addCourseToGroup,
  setBatchModerators,
} from '../../services/groupService';
import { PROGRAM_OPTIONS, PROGRAMS } from '../../data/programTypes';
import { filterBatchesForModerator } from '../../utils/batchScope';
import { getEvents } from '../../services/eventService';
import EventCalendar from './EventCalendar';
import TicketManager from './TicketManager';
import RoleSelect from './RoleSelect';
import AdminOverviewCharts from './AdminOverviewCharts';
import ZohoIntegration from './ZohoIntegration';
import MBWAdminDashboard from './MBWAdminDashboard';
import { ROLES, getRoleLabel, isAdminRole, isModeratorOnly, isFullAdmin } from '../../utils/roles';
import { isSuperAdminEmail } from '../../utils/constants';
import { getAllTickets, TICKET_STATUSES } from '../../services/ticketService';
import {
  LayoutDashboard,
  Users as UsersIcon,
  LifeBuoy,
  TrendingUp,
  Clock,
  CalendarDays,
  BookOpen,
  Paperclip,
  Boxes,
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
  Link2,
  ListChecks,
} from 'lucide-react';

const RESOURCE_TYPES = ['video', 'pdf', 'ppt', 'assignment', 'mock_test'];
export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Dashboard summary' },
  { id: 'users', label: 'Users', icon: UsersIcon, desc: 'Assign users as admin' },
  { id: 'tickets', label: 'Support tickets', icon: LifeBuoy, desc: 'Assign & reply to issues' },
  { id: 'progress', label: 'Progress', icon: TrendingUp, desc: 'Enrollments & activity' },
  { id: 'activity', label: 'Activity', icon: Clock, desc: 'Activity log' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, desc: 'Events' },
  { id: 'courses', label: 'Courses', icon: BookOpen, desc: 'Create & upload courses' },
  { id: 'resources', label: 'Resources', icon: Paperclip, desc: 'PDF / PPT / links' },
  { id: 'groups', label: 'Batches', icon: Boxes, desc: 'Learner batches' },
  { id: 'zoho', label: 'Zoho CRM', icon: Link2, desc: 'CRM sync & status' },
  { id: 'mbw', label: 'MBW Tasks', icon: ListChecks, desc: 'Pre-session tracker' },
];

export const MODERATOR_TABS = [
  { id: 'mbw', label: 'My batches', icon: ListChecks, desc: 'Track your learners & MBW tasks' },
  { id: 'tickets', label: 'Support', icon: LifeBuoy, desc: 'Student support tickets' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, desc: 'Sessions & events' },
];
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'progress', label: 'Progress' },
  { id: 'activity', label: 'Activity' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'courses', label: 'Courses' },
  { id: 'resources', label: 'Resources' },
  { id: 'groups', label: 'Batches' },
  { id: 'zoho', label: 'Zoho CRM' },
  { id: 'mbw', label: 'MBW Tasks' },
];

const ROLE_OPTIONS_ADMIN = [
  { value: ROLES.STUDENT, label: 'User' },
  { value: ROLES.MODERATOR, label: 'Customer Expression' },
  { value: ROLES.ADMIN, label: 'Admin' },
];

const ROLE_OPTIONS_SUPER = [
  ...ROLE_OPTIONS_ADMIN,
  { value: ROLES.SUPERADMIN, label: 'Super Admin' },
];

function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

export default function AdminPanel({ isSuperAdmin = false, tab: controlledTab, onTabChange }) {
  const { user, role } = useAuth();
  const moderatorView = isModeratorOnly(role);
  const fullAdmin = isFullAdmin(role) || isSuperAdmin;
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [internalTab, setInternalTab] = useState('overview');
  // Controlled when AdminShell drives the tab via the sidebar; otherwise local.
  const isControlled = controlledTab != null;
  const tab = isControlled ? controlledTab : internalTab;
  const setTab = isControlled ? (onTabChange ?? (() => {})) : setInternalTab;
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [usersError, setUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userActivities, setUserActivities] = useState([]);

  const [courseForm, setCourseForm] = useState({
    title: '',
    code: '',
    description: '',
    thumbnail: '',
    introUrl: '',
  });
  const [courseThumbnailFile, setCourseThumbnailFile] = useState(null);

  const [resourceForm, setResourceForm] = useState({
    courseId: '',
    title: '',
    type: 'video',
    url: '',
    description: '',
    uploadMode: 'link',
  });
  const [resourceFile, setResourceFile] = useState(null);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    program: PROGRAMS.MBW,
    moderatorIds: [],
  });
  const [userSearch, setUserSearch] = useState('');

  const roleOptions = isSuperAdmin ? ROLE_OPTIONS_SUPER : ROLE_OPTIONS_ADMIN;
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
  const myBatches = useMemo(
    () => (moderatorView ? filterBatchesForModerator(groups, user?.uid) : groups),
    [groups, moderatorView, user?.uid]
  );
  const cxtTeam = useMemo(
    () => users.filter((u) => u.role === ROLES.MODERATOR || u.role === ROLES.ADMIN),
    [users]
  );

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      getRoleLabel(u.role).toLowerCase().includes(q)
    );
  });

  const load = async () => {
    setLoading(true);
    setError('');
    setLoadWarnings([]);
    setUsersError('');
    const warnings = [];

    const tryLoad = async (label, fn, setter) => {
      try {
        setter(await fn());
      } catch (e) {
        console.error(`${label}:`, e);
        const detail = `${e.code ? `[${e.code}] ` : ''}${e.message}`;
        warnings.push(`${label}: ${detail}`);
        if (label === 'Users') setUsersError(detail);
        setter([]);
      }
    };

    await Promise.all([
      tryLoad('Users', getAllUsers, setUsers),
      tryLoad('Courses', getCourses, setCourses),
      tryLoad('Resources', getResources, setResources),
      tryLoad('Activity', () => getAllActivities(150), setActivities),
      tryLoad('Groups', getGroups, setGroups),
      tryLoad('Events', getEvents, setEvents),
      tryLoad('Tickets', getAllTickets, setTickets),
    ]);

    if (warnings.length) setLoadWarnings(warnings);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setUserActivities([]);
      return;
    }
    getUserActivities(selectedUserId, 30).then(setUserActivities).catch(console.error);
  }, [selectedUserId]);

  const stats = {
    total: users.length,
    userAccounts: users.filter((u) => (u.role || ROLES.STUDENT) === ROLES.STUDENT).length,
    admins: users.filter((u) => [ROLES.ADMIN, ROLES.MODERATOR, ROLES.SUPERADMIN].includes(u.role)).length,
    enrolled: users.reduce((n, u) => n + (u.enrolledCourses?.length || 0), 0),
    openTickets: tickets.filter((t) => t.status !== TICKET_STATUSES.RESOLVED).length,
  };

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setMessage('');
    try {
      let thumbnail = courseForm.thumbnail;
      if (courseThumbnailFile) {
        const uploaded = await uploadCourseAsset(courseThumbnailFile);
        thumbnail = uploaded.url;
      }
      await createCourse({ ...courseForm, thumbnail, introUrl: courseForm.introUrl });
      setCourseForm({ title: '', code: '', description: '', thumbnail: '', introUrl: '' });
      setCourseThumbnailFile(null);
      setMessage('Course created.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setMessage('');
    try {
      let url = resourceForm.url;
      let type = resourceForm.type;

      if (resourceForm.uploadMode === 'file' && !editingResourceId) {
        if (!resourceFile) throw new Error('Choose a PDF or PPT file to upload.');
        const uploaded = await uploadResourceFile(resourceFile);
        url = uploaded.url;
        type = resourceTypeFromFile(resourceFile);
      } else if (resourceForm.uploadMode === 'link' && !url) {
        throw new Error('Enter a resource URL or upload a file.');
      }

      if (editingResourceId) {
        await updateResource(editingResourceId, {
          courseId: resourceForm.courseId,
          title: resourceForm.title,
          type: resourceForm.type,
          url: resourceForm.url,
          description: resourceForm.description,
        });
        setMessage('Resource updated.');
      } else {
        await createResource({ ...resourceForm, url, type });
        setMessage('Resource added.');
      }

      resetResourceForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetResourceForm = () => {
    setResourceForm({
      courseId: '',
      title: '',
      type: 'video',
      url: '',
      description: '',
      uploadMode: 'link',
    });
    setResourceFile(null);
    setEditingResourceId(null);
  };

  const startEditResource = (r) => {
    setEditingResourceId(r.id);
    setResourceForm({
      courseId: r.courseId || '',
      title: r.title || '',
      type: r.type || 'video',
      url: r.url || '',
      description: r.description || '',
      uploadMode: 'link',
    });
    setResourceFile(null);
    setMessage('');
    setError('');
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await deleteResource(resourceId);
      if (editingResourceId === resourceId) resetResourceForm();
      setMessage('Resource deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (uid, role) => {
    setError('');
    setMessage('');
    try {
      await assignAdminRole(uid, role);
      setMessage('Role updated. Admins can upload courses & resources.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleResourceLock = async (resource) => {
    setError('');
    setMessage('');
    try {
      await setResourceLocked(resource.id, !resource.locked);
      setMessage(resource.locked ? 'Resource unlocked for users.' : 'Resource locked for users.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const canBlockUser = (u) =>
    u.id !== user?.uid && !isSuperAdminEmail(u.email) && !isAdminRole(u.role);

  const handleToggleUserBlock = async (targetUser) => {
    if (!canBlockUser(targetUser)) return;
    const next = !targetUser.blocked;
    const label = targetUser.displayName || targetUser.email;
    if (!window.confirm(`${next ? 'Block' : 'Unblock'} ${label}?`)) return;
    setError('');
    setMessage('');
    try {
      await setUserBlocked(targetUser.id, next);
      setMessage(next ? `${label} has been blocked.` : `${label} can access the app again.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await createGroup({ ...groupForm, createdBy: user?.uid });
      setGroupForm({ name: '', description: '', program: PROGRAMS.MBW, moderatorIds: [] });
      setMessage('Batch created.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleGroupModerator = (moderatorId) => {
    setGroupForm((prev) => {
      const set = new Set(prev.moderatorIds || []);
      if (set.has(moderatorId)) set.delete(moderatorId);
      else set.add(moderatorId);
      return { ...prev, moderatorIds: [...set] };
    });
  };

  const activityCountByUser = activities.reduce((acc, a) => {
    acc[a.userId] = (acc[a.userId] || 0) + 1;
    return acc;
  }, {});

  if (loading && users.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading admin data…</p>
      </div>
    );
  }

  return (
    <>
      {!isControlled && (
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <main className="admin-main">
        {message && <p className="success-text admin-message">{message}</p>}
        {error && <div className="alert alert-error admin-message">{error}</div>}
        {loadWarnings.length > 0 && (
          <div className="alert alert-error admin-message permission-banner">
            <strong>Some data could not load.</strong>
            <ul>
              {loadWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="muted">
              Deploy <code>firestore.rules</code> in Firebase Console → Firestore → Rules, then click Refresh.
              Users like jaytiwari092@gmail.com appear after they sign in once and rules allow admin read access.
            </p>
          </div>
        )}

        {tab === 'overview' && fullAdmin && (
          <section className="admin-section">
            {users.length === 0 && !loading && (
              <div className="muted-box admin-message">
                {usersError ? (
                  <>
                    <strong>Can't read users — Firestore blocked the request.</strong>
                    <p className="diag-error">{usersError}</p>
                    {usersError.includes('permission') ? (
                      <p className="muted">
                        Your security rules are not published (or are outdated). Go to{' '}
                        <a
                          href="https://console.firebase.google.com/project/lmsironlady/firestore/rules"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Firestore → Rules
                        </a>
                        , paste the contents of <code>firestore.rules</code> from the project, click{' '}
                        <strong>Publish</strong>, then press Refresh below.
                      </p>
                    ) : (
                      <p className="muted">Press Refresh below after checking your Firebase setup.</p>
                    )}
                  </>
                ) : (
                  <>
                    <strong>No user profiles found in the database yet.</strong>
                    <p className="muted">
                      The read succeeded but the <code>users</code> collection is empty. Have the user (e.g.
                      jaytiwari092@gmail.com) sign in once — this creates their profile — then press Refresh.
                    </p>
                  </>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={load}>
                  Refresh now
                </button>
              </div>
            )}
            <div className="stats-grid">
              {[
                { Icon: UsersIcon, value: stats.total, label: 'Total accounts', tone: 'indigo' },
                { Icon: GraduationCap, value: stats.userAccounts, label: 'Learners', tone: 'blue' },
                { Icon: ShieldCheck, value: stats.admins, label: 'Admins & staff', tone: 'violet' },
                { Icon: BookOpen, value: courses.length, label: 'Courses', tone: 'green' },
                { Icon: Paperclip, value: resources.length, label: 'Resources', tone: 'teal' },
                { Icon: CheckCircle2, value: stats.enrolled, label: 'Enrollments', tone: 'cyan' },
                { Icon: LifeBuoy, value: stats.openTickets, label: 'Open tickets', tone: 'amber' },
              ].map(({ Icon, value, label, tone }) => (
                <div key={label} className={`stat-card stat-card--${tone}`}>
                  <span className="stat-card__icon">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <div>
                    <span className="stat-card__value">{value}</span>
                    <span className="stat-card__label">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            {stats.openTickets > 0 && (
              <button type="button" className="overview-alert" onClick={() => setTab('tickets')}>
                <LifeBuoy size={16} /> {stats.openTickets} support ticket(s) need attention — open Tickets →
              </button>
            )}

            <AdminOverviewCharts
              users={users}
              tickets={tickets}
              activities={activities}
              courses={courses}
              resources={resources}
              stats={stats}
              userMap={userMap}
            />

            <h3 className="admin-section__title">Recent activity</h3>
            <ul className="admin-list">
              {activities.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{userMap[a.userId]?.displayName || 'User'}</strong>
                    <span className="muted"> — {a.title || a.type}</span>
                  </div>
                  <span className="muted">{formatTime(a.createdAt)}</span>
                </li>
              ))}
              {activities.length === 0 && <li className="muted">No activity yet.</li>}
            </ul>
          </section>
        )}

        {tab === 'courses' && fullAdmin && (
          <section className="admin-section">
            <div className="admin-card">
              <div className="admin-card__head">
                <span className="admin-card__icon"><BookOpen size={22} /></span>
                <div>
                  <h3>Create a course</h3>
                  <p className="muted">Add a thumbnail by URL or upload an image, plus an optional intro video.</p>
                </div>
              </div>
              <form className="admin-card__form admin-card__form--grid" onSubmit={handleCreateCourse}>
                <label className="field">
                  <span>Title</span>
                  <input
                    placeholder="e.g. Mastering Business Workflows"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Code</span>
                  <input
                    placeholder="MBW / LEP"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    required
                  />
                </label>
                <label className="field field--full">
                  <span>Description</span>
                  <input
                    placeholder="Short summary of the course"
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Thumbnail URL</span>
                  <input
                    placeholder="https://… (optional)"
                    value={courseForm.thumbnail}
                    onChange={(e) => setCourseForm({ ...courseForm, thumbnail: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Or upload thumbnail</span>
                  <input type="file" accept="image/*" onChange={(e) => setCourseThumbnailFile(e.target.files?.[0] || null)} />
                </label>
                <label className="field field--full">
                  <span>Intro video URL</span>
                  <input
                    placeholder="YouTube / Vimeo link (optional)"
                    value={courseForm.introUrl}
                    onChange={(e) => setCourseForm({ ...courseForm, introUrl: e.target.value })}
                  />
                </label>
                <div className="admin-card__actions">
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Uploading…' : '+ Create course'}
                  </button>
                </div>
              </form>
            </div>

            <h3 className="admin-section__title">All courses ({courses.length})</h3>
            <ul className="admin-list">
              {courses.map((c) => (
                <li key={c.id}>
                  <div className="admin-list__content">
                    <div className="admin-list__title-row">
                      {c.thumbnail && <img src={c.thumbnail} alt="" className="course-thumb-sm" />}
                      <strong>{c.code}</strong>
                      <span className="muted">— {c.title}</span>
                    </div>
                    {c.introUrl && (
                      <div className="admin-list__meta muted">
                        <a href={c.introUrl} target="_blank" rel="noreferrer" className="link-inline">
                          Intro link
                        </a>
                      </div>
                    )}
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
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteCourse(c.id).then(load)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'resources' && fullAdmin && (
          <section className="admin-section">
            <div className="admin-card">
              <div className="admin-card__head">
                <span className="admin-card__icon"><Paperclip size={22} /></span>
                <div>
                  <h3>{editingResourceId ? 'Edit resource' : 'Add a resource'}</h3>
                  <p className="muted">
                    {editingResourceId
                      ? 'Update title, course, type, or URL for this resource.'
                      : 'Share a video link, or upload a PDF / PPT to Firebase Storage.'}
                  </p>
                </div>
              </div>
              <form className="admin-card__form admin-card__form--grid" onSubmit={handleCreateResource}>
                <label className="field">
                  <span>Course</span>
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
                </label>
                <label className="field">
                  <span>Title</span>
                  <input
                    placeholder="Resource title"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Source</span>
                  <select
                    value={resourceForm.uploadMode}
                    onChange={(e) => setResourceForm({ ...resourceForm, uploadMode: e.target.value })}
                    disabled={Boolean(editingResourceId)}
                  >
                    <option value="link">Add via link (URL)</option>
                    <option value="file">Upload file (PDF / PPT)</option>
                  </select>
                </label>
                {resourceForm.uploadMode === 'link' || editingResourceId ? (
                  <>
                    <label className="field">
                      <span>Type</span>
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
                    </label>
                    <label className="field field--full">
                      <span>URL</span>
                      <input
                        placeholder="YouTube, CloudFront, PDF link…"
                        value={resourceForm.url}
                        onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <label className="field field--full">
                    <span>Choose PDF or PowerPoint</span>
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                )}
                <div className="admin-card__actions">
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Saving…' : editingResourceId ? 'Save changes' : '+ Add resource'}
                  </button>
                  {editingResourceId && (
                    <button type="button" className="btn btn-outline" onClick={resetResourceForm}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <h3 className="admin-section__title">All resources ({resources.length})</h3>
            <ul className="admin-list">
              {resources.map((r) => (
                <li key={r.id}>
                  <div className="admin-list__content">
                    <div className="admin-list__title-row">
                      <strong>{r.title}</strong>
                      <span className="badge">{r.type}</span>
                      {r.locked && <span className="badge badge-locked">Locked</span>}
                    </div>
                    <div className="admin-list__meta muted">
                      {courseMap[r.courseId]?.code || 'Course'}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" className="link-inline">
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="admin-list__actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${r.locked ? 'btn-outline' : 'btn-warning'}`}
                      onClick={() => handleToggleResourceLock(r)}
                    >
                      {r.locked ? 'Unlock' : 'Lock'}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => startEditResource(r)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteResource(r.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {resources.length === 0 && <li className="muted">No resources yet.</li>}
            </ul>
          </section>
        )}

        {tab === 'users' && fullAdmin && (
          <section>
            <h2>All users ({users.length})</h2>
            <p className="muted">
              Assign roles, block users who should not access the app, or promote staff to admin.
            </p>
            <div className="admin-form">
              <input
                placeholder="Search by name, email, or role (e.g. jaytiwari)"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="admin-form__search"
                style={{ flex: 1, minWidth: 220 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={load}>
                Refresh
              </button>
            </div>
            <ul className="admin-list">
              {filteredUsers.map((u) => (
                <li key={u.id}>
                  <div className="user-row">
                    <div>
                      <strong>{u.displayName}</strong>
                      <span className="muted"> {u.email}</span>
                      <span className="badge">{getRoleLabel(u.role)}</span>
                      {u.blocked && <span className="badge badge-blocked">Blocked</span>}
                    </div>
                    <div className="user-row__meta muted">
                      Courses: {(u.enrolledCourses || []).length} · Streak: {u.streak ?? 0} · Activities:{' '}
                      {activityCountByUser[u.id] || 0}
                    </div>
                  </div>
                  <div className="user-row__controls">
                    <RoleSelect
                      value={u.role || ROLES.STUDENT}
                      options={roleOptions}
                      onChange={(role) => handleRoleChange(u.id, role)}
                    />
                    {canBlockUser(u) ? (
                      <button
                        type="button"
                        className={`btn btn-sm ${u.blocked ? 'btn-outline' : 'btn-danger'}`}
                        onClick={() => handleToggleUserBlock(u)}
                      >
                        {u.blocked ? 'Unblock' : 'Block user'}
                      </button>
                    ) : (
                      <span className="muted user-row__protected">Protected account</span>
                    )}
                  </div>
                </li>
              ))}
              {filteredUsers.length === 0 && (
                <li className="muted">
                  {users.length === 0
                    ? 'No users yet. When someone signs up (e.g. jaytiwari), they will appear here.'
                    : 'No users match your search.'}
                </li>
              )}
            </ul>
          </section>
        )}

        {tab === 'progress' && fullAdmin && (
          <section>
            <h2>User progress &amp; enrollments</h2>
            <p className="muted">Track which courses each user is enrolled in and their learning activity.</p>
            <div className="progress-table-wrap">
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Enrolled courses</th>
                    <th>Streak</th>
                    <th>Activities</th>
                    <th>Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.displayName}</strong>
                        <br />
                        <span className="muted">{u.email}</span>
                      </td>
                      <td>
                        <span className="badge">{getRoleLabel(u.role)}</span>
                      </td>
                      <td>
                        {(u.enrolledCourses || []).length === 0 ? (
                          <span className="muted">None</span>
                        ) : (
                          (u.enrolledCourses || []).map((cid) => (
                            <span key={cid} className="course-pill">
                              {courseMap[cid]?.code || courseMap[cid]?.title || cid.slice(0, 6)}
                            </span>
                          ))
                        )}
                      </td>
                      <td>{u.streak ?? 0}</td>
                      <td>{activityCountByUser[u.id] || 0}</td>
                      <td className="muted">{formatTime(u.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'activity' && fullAdmin && (
          <section>
            <h2>User activity</h2>
            <div className="admin-form">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">All users (recent)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <ul className="admin-list">
              {(selectedUserId ? userActivities : activities).map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{userMap[a.userId]?.displayName || a.userId}</strong>
                    <span className="muted"> — {a.title || a.type}</span>
                    {a.courseId && <span className="badge">{a.courseId.slice(0, 8)}…</span>}
                  </div>
                  <span className="muted">{formatTime(a.createdAt)}</span>
                </li>
              ))}
              {(selectedUserId ? userActivities : activities).length === 0 && (
                <li className="muted">No activity recorded.</li>
              )}
            </ul>
          </section>
        )}

        {tab === 'calendar' && (
          <section>
            <h2>Events calendar</h2>
            <p className="muted">Schedule classes, deadlines, and meetings. Visible to all signed-in users.</p>
            <EventCalendar events={events} onRefresh={load} createdBy={user?.uid} />
          </section>
        )}

        {tab === 'tickets' && (
          <TicketManager users={users} isSuperAdmin={isSuperAdmin} onRefresh={load} />
        )}

        {tab === 'groups' && fullAdmin && (
          <section>
            <h2>Batches</h2>
            <p className="muted">
              Create cohort batches, assign Customer Expression leads, and add learners.
            </p>
            <form className="admin-form admin-form--stacked" onSubmit={handleCreateGroup}>
              <input
                placeholder="Batch name (e.g. MBW January 2026)"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                required
              />
              <input
                placeholder="Description (optional)"
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              />
              <label className="field">
                Program
                <select
                  value={groupForm.program}
                  onChange={(e) => setGroupForm({ ...groupForm, program: e.target.value })}
                >
                  {PROGRAM_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {cxtTeam.length > 0 && (
                <fieldset className="batch-moderators-field">
                  <legend>Customer Expression lead(s)</legend>
                  <div className="batch-moderators-field__list">
                    {cxtTeam.map((u) => (
                      <label key={u.id} className="batch-moderators-field__item">
                        <input
                          type="checkbox"
                          checked={(groupForm.moderatorIds || []).includes(u.id)}
                          onChange={() => toggleGroupModerator(u.id)}
                        />
                        {u.displayName || u.email}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <button type="submit" className="btn btn-primary btn-sm">
                Create batch
              </button>
            </form>
            <ul className="admin-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <span className="badge">{g.program || 'mbw'}</span>
                    <p className="muted">{g.description || 'No description'}</p>
                    <div className="group-meta muted">
                      {(g.memberIds || []).length} members · {(g.courseIds || []).length} courses
                    </div>
                    <p className="muted batch-moderators-field__assigned">
                      CXT:{' '}
                      {(g.moderatorIds || [])
                        .map((id) => users.find((u) => u.id === id)?.displayName || id.slice(0, 8))
                        .join(', ') || 'None assigned'}
                    </p>
                    <div className="admin-form batch-moderators-field__edit">
                      <select
                        defaultValue=""
                        onChange={async (e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          const next = [...new Set([...(g.moderatorIds || []), uid])];
                          await setBatchModerators(g.id, next);
                          load();
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Assign CXT lead</option>
                        {cxtTeam
                          .filter((u) => !(g.moderatorIds || []).includes(u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.displayName || u.email}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="admin-form" style={{ marginTop: '0.5rem' }}>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addMemberToGroup(g.id, e.target.value).then(load);
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Add learner</option>
                        {users
                          .filter((u) => !u.role || u.role === ROLES.STUDENT)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.displayName || u.email}
                            </option>
                          ))}
                      </select>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addCourseToGroup(g.id, e.target.value).then(load);
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Add course</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteGroup(g.id).then(load)}>
                    Delete
                  </button>
                </li>
              ))}
              {groups.length === 0 && <li className="muted">No batches yet. Create one above.</li>}
            </ul>
          </section>
        )}

        {tab === 'zoho' && fullAdmin && <ZohoIntegration users={users} />}

        {tab === 'mbw' && (
          <MBWAdminDashboard
            users={users}
            batches={moderatorView ? myBatches : groups}
            isScoped={moderatorView}
            onRefresh={load}
          />
        )}
      </main>
    </>
  );
}
