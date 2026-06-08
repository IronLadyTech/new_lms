import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getUserActivities } from '../../services/userService';
import { getRoleLabel } from '../../utils/roles';
import { statusLabel } from '../../services/ticketService';
import ActivityLogList from '../ActivityLogList';

function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function UserProgressModal({
  user,
  courseMap = {},
  groups = [],
  tickets = [],
  activityCount = 0,
  onClose,
}) {
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [user, onClose]);

  useEffect(() => {
    if (!user?.id) {
      setActivities([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingActivities(true);
    getUserActivities(user.id, 40)
      .then((acts) => {
        if (!cancelled) setActivities(acts);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingActivities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const enrolledCourses = useMemo(() => {
    return (user?.enrolledCourses || []).map((id) => courseMap[id]).filter(Boolean);
  }, [user, courseMap]);

  const userGroups = useMemo(() => {
    return groups.filter((g) => (g.memberIds || []).includes(user?.id));
  }, [groups, user?.id]);

  const userTickets = useMemo(() => {
    return tickets
      .filter((t) => t.userId === user?.id)
      .sort((a, b) => {
        const ta = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || 0;
        const tb = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || 0;
        return tb - ta;
      });
  }, [tickets, user?.id]);

  if (!user) return null;

  const initials = (user.displayName || user.email || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return createPortal(
    <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
      <button type="button" className="user-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="user-modal__panel">
        <div className="user-modal__header">
          <div className="user-modal__identity">
            <span className="user-modal__avatar">{initials || '?'}</span>
            <div>
              <h2 id="user-modal-title" className="user-modal__title">
                {user.displayName || 'User'}
              </h2>
              <p className="user-modal__email muted">{user.email}</p>
              <div className="user-modal__badges">
                <span className="badge">{getRoleLabel(user.role)}</span>
                {user.blocked && <span className="badge badge-blocked">Blocked</span>}
              </div>
            </div>
          </div>
          <button type="button" className="user-modal__close btn btn-outline btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="user-modal__stats">
          <div className="user-modal__stat">
            <span className="user-modal__stat-value">{user.streak ?? 0}</span>
            <span className="user-modal__stat-label">Day streak</span>
          </div>
          <div className="user-modal__stat">
            <span className="user-modal__stat-value">{activityCount}</span>
            <span className="user-modal__stat-label">Activities</span>
          </div>
          <div className="user-modal__stat">
            <span className="user-modal__stat-value">{enrolledCourses.length}</span>
            <span className="user-modal__stat-label">Courses</span>
          </div>
          <div className="user-modal__stat">
            <span className="user-modal__stat-value user-modal__stat-value--sm">{formatTime(user.lastActivityAt)}</span>
            <span className="user-modal__stat-label">Last active</span>
          </div>
          <div className="user-modal__stat">
            <span className="user-modal__stat-value user-modal__stat-value--sm">{formatTime(user.createdAt)}</span>
            <span className="user-modal__stat-label">Joined</span>
          </div>
        </div>

        <div className="user-modal__body">
          <section className="user-modal__section">
            <h3>Enrolled courses</h3>
            {enrolledCourses.length === 0 ? (
              <p className="muted">Not enrolled in any courses yet.</p>
            ) : (
              <ul className="user-modal__course-list">
                {enrolledCourses.map((course) => (
                  <li key={course.id} className="user-modal__course-item">
                    <span className="course-pill">{course.code || '—'}</span>
                    <div>
                      <strong>{course.title}</strong>
                      {course.description && <p className="muted user-modal__course-desc">{course.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="user-modal__section">
            <h3>Batches</h3>
            {userGroups.length === 0 ? (
              <p className="muted">Not assigned to any batch.</p>
            ) : (
              <ul className="user-modal__tag-list">
                {userGroups.map((g) => (
                  <li key={g.id}>
                    <span className="badge badge--soft">{g.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="user-modal__section">
            <h3>Support tickets</h3>
            {userTickets.length === 0 ? (
              <p className="muted">No support tickets submitted.</p>
            ) : (
              <ul className="user-modal__ticket-list">
                {userTickets.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <strong>{t.subject}</strong>
                    <span className="badge badge--soft">{statusLabel(t.status)}</span>
                    <span className="muted user-modal__ticket-time">{formatTime(t.updatedAt || t.createdAt)}</span>
                  </li>
                ))}
                {userTickets.length > 5 && (
                  <li className="muted">+ {userTickets.length - 5} more ticket{userTickets.length - 5 === 1 ? '' : 's'}</li>
                )}
              </ul>
            )}
          </section>

          <section className="user-modal__section">
            <h3>Recent activity</h3>
            {loadingActivities ? (
              <div className="user-modal__loading">
                <div className="spinner" />
                <span className="muted">Loading activity…</span>
              </div>
            ) : (
              <ActivityLogList
                activities={activities}
                courseMap={courseMap}
                emptyMessage="No activity recorded for this user yet."
              />
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
