import { useEffect, useMemo, useState } from 'react';
import { Bell, MessageCircle, UserPlus, Activity, X } from 'lucide-react';
import { getAllTickets, TICKET_STATUSES, categoryLabel } from '../../services/ticketService';
import { getAllActivities, getAllUsers } from '../../services/userService';
import { ROLES } from '../../utils/roles';

const DISMISSED_KEY = 'ilms_admin_dismissed_notifications';

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function setDismissed(ids) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

function ts(item) {
  return item?.createdAt?.toMillis?.() ?? 0;
}

function formatWhen(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString();
}

function formatActivity(a, userMap) {
  const name = userMap[a.userId]?.displayName || userMap[a.userId]?.email?.split('@')[0] || 'User';
  if (a.type === 'resource_view') {
    return { title: 'User viewed a resource', body: `${name} opened "${a.title || 'content'}"` };
  }
  if (a.type === 'ticket_created') {
    return { title: 'Support ticket created', body: `${name} submitted "${a.title || 'ticket'}"` };
  }
  if (a.type === 'ticket_reply') {
    return { title: 'User replied on ticket', body: `${name}: ${a.title || 'New message'}` };
  }
  if (a.type === 'course_enroll') {
    return { title: 'User enrolled in course', body: `${name} joined course ${a.courseId || a.title || ''}` };
  }
  return {
    title: 'User activity',
    body: `${name} · ${a.title || a.type}${a.courseId ? ` · ${a.courseId}` : ''}`,
  };
}

function buildAdminNotifications(tickets, activities, users) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const items = [];
  const recentCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

  tickets
    .filter((t) => t.status === TICKET_STATUSES.OPEN)
    .slice(0, 12)
    .forEach((t) => {
      items.push({
        id: `admin-ticket-${t.id}`,
        kind: 'ticket',
        tab: 'tickets',
        title: 'New support ticket',
        body: `${t.userDisplayName || t.userEmail}: ${t.subject} (${categoryLabel(t.category)})`,
        at: ts(t),
      });
    });

  tickets
    .filter((t) => t.status === TICKET_STATUSES.ASSIGNED)
    .slice(0, 6)
    .forEach((t) => {
      items.push({
        id: `admin-ticket-assigned-${t.id}`,
        kind: 'ticket',
        tab: 'tickets',
        title: 'Ticket in progress',
        body: `"${t.subject}" assigned to ${t.assignedToName || 'staff'}`,
        at: ts(t),
      });
    });

  users
    .filter((u) => (u.role || ROLES.STUDENT) === ROLES.STUDENT && ts(u) >= recentCutoff)
    .slice(0, 8)
    .forEach((u) => {
      items.push({
        id: `admin-user-${u.id}`,
        kind: 'user',
        tab: 'users',
        title: 'New user joined',
        body: `${u.displayName || u.email} created an account`,
        at: ts(u),
      });
    });

  activities.slice(0, 12).forEach((a) => {
    const copy = formatActivity(a, userMap);
    items.push({
      id: `admin-activity-${a.id}`,
      kind: 'activity',
      tab: 'activity',
      title: copy.title,
      body: copy.body,
      at: ts(a),
    });
  });

  return items.sort((a, b) => b.at - a.at).slice(0, 24);
}

export default function AdminNotificationBell({ onTabChange }) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [dismissed, setDismissedState] = useState(getDismissed);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [tk, acts, usrs] = await Promise.all([getAllTickets(), getAllActivities(40), getAllUsers()]);
        if (!cancelled) {
          setTickets(tk);
          setActivities(acts);
          setUsers(usrs);
        }
      } catch (e) {
        console.error(e);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const notifications = useMemo(
    () => buildAdminNotifications(tickets, activities, users),
    [tickets, activities, users]
  );
  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  const count = visible.length;

  const dismissOne = (id) => {
    const next = [...new Set([...dismissed, id])];
    setDismissedState(next);
    setDismissed(next);
  };

  const dismissAll = () => {
    const next = [...new Set([...dismissed, ...visible.map((n) => n.id)])];
    setDismissedState(next);
    setDismissed(next);
  };

  const handleOpen = (n) => {
    onTabChange?.(n.tab);
    setOpen(false);
  };

  return (
    <div className={`notification-bell notification-bell--admin${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Admin notifications${count ? `, ${count} new` : ''}`}
      >
        <Bell size={18} strokeWidth={2} />
        {count > 0 && <span className="notification-bell__badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="notification-bell__backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <div className="notification-bell__panel">
            <div className="notification-bell__head">
              <strong>Admin alerts</strong>
              <div className="notification-bell__head-actions">
                {count > 0 && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={dismissAll}>
                    Clear all
                  </button>
                )}
                <button type="button" className="notification-bell__close" onClick={() => setOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <ul className="notification-bell__list">
              {visible.length === 0 ? (
                <li className="notification-bell__empty muted">No new admin alerts.</li>
              ) : (
                visible.map((n) => (
                  <li key={n.id} className={`notification-bell__item notification-bell__item--${n.kind}`}>
                    <button type="button" className="notification-bell__link" onClick={() => handleOpen(n)}>
                      <span className="notification-bell__item-icon">
                        {n.kind === 'ticket' && <MessageCircle size={16} />}
                        {n.kind === 'user' && <UserPlus size={16} />}
                        {n.kind === 'activity' && <Activity size={16} />}
                      </span>
                      <span>
                        <strong>{n.title}</strong>
                        <span className="muted">{n.body}</span>
                        {n.at > 0 && <span className="notification-bell__when muted">{formatWhen(n.at)}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="notification-bell__dismiss"
                      onClick={() => dismissOne(n.id)}
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
