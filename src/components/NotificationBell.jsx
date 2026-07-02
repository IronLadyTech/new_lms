import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Megaphone, MessageCircle, UserCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEvents } from '../services/eventService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../services/announcementService';
import { getUserTickets, statusLabel, TICKET_STATUSES } from '../services/ticketService';
import { calendarEventUrl } from './EventPreviewCard';

const DISMISSED_KEY = 'ilms_dismissed_notifications';

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

function buildNotifications(events, tickets, announcements, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const items = [];

  getActiveAnnouncementsForUser(announcements, userId)
    .slice(0, 10)
    .forEach((a) => {
      const tagged = (a.taggedUserIds || []).includes(userId);
      items.push({
        id: `announcement-${a.id}`,
        kind: 'announcement',
        title: a.title,
        body: tagged ? `${a.body.slice(0, 80)} · You're tagged` : a.body.slice(0, 100),
        link: '/app/home',
      });
    });

  events
    .filter((e) => e.date >= today)
    .slice(0, 8)
    .forEach((ev) => {
      items.push({
        id: `event-${ev.id}`,
        kind: 'event',
        title: ev.title,
        body: `${ev.date}${ev.time ? ` · ${ev.time}` : ''}${ev.type ? ` · ${ev.type}` : ''}`,
        link: calendarEventUrl(ev),
      });
    });

  tickets
    .filter((t) => t.status !== TICKET_STATUSES.RESOLVED)
    .slice(0, 10)
    .forEach((t) => {
      if (t.status === TICKET_STATUSES.ASSIGNED) {
        items.push({
          id: `ticket-assigned-${t.id}`,
          kind: 'assigned',
          title: 'Ticket assigned',
          body: t.assignedToName
            ? `"${t.subject}" is now with ${t.assignedToName}.`
            : `"${t.subject}" has been assigned to support staff.`,
          link: '/app/support',
        });
      } else {
        items.push({
          id: `ticket-open-${t.id}`,
          kind: 'ticket',
          title: t.subject,
          body: `Support ticket · ${statusLabel(t.status)}`,
          link: '/app/support',
        });
      }
    });

  return items;
}

export default function NotificationBell() {
  const { user, isGuest } = useAuth();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissedState] = useState(getDismissed);

  useEffect(() => {
    if (!user || isGuest) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const [ev, tk, ann] = await Promise.all([getEvents(), getUserTickets(user.uid), getAnnouncements()]);
        if (!cancelled) {
          setEvents(ev);
          setTickets(tk);
          setAnnouncements(ann);
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
  }, [user, isGuest]);

  const notifications = useMemo(
    () => buildNotifications(events, tickets, announcements, user?.uid),
    [events, tickets, announcements, user?.uid]
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

  if (isGuest || !user) return null;

  return (
    <div className={`notification-bell${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? `, ${count} new` : ''}`}
      >
        <Bell size={18} strokeWidth={2} />
        {count > 0 && <span className="notification-bell__badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <>
          <button type="button" className="notification-bell__backdrop" onClick={() => setOpen(false)} aria-label="Close notifications" />
          <div className="notification-bell__panel">
            <div className="notification-bell__head">
              <strong>Notifications</strong>
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
                <li className="notification-bell__empty muted">No new notifications.</li>
              ) : (
                visible.map((n) => (
                  <li key={n.id} className={`notification-bell__item notification-bell__item--${n.kind}`}>
                    <Link to={n.link} className="notification-bell__link" onClick={() => setOpen(false)}>
                      <span className="notification-bell__item-icon">
                        {n.kind === 'event' && <CalendarDays size={16} />}
                        {n.kind === 'assigned' && <UserCheck size={16} />}
                        {n.kind === 'ticket' && <MessageCircle size={16} />}
                        {n.kind === 'announcement' && <Megaphone size={16} />}
                      </span>
                      <span>
                        <strong>{n.title}</strong>
                        <span className="muted">{n.body}</span>
                      </span>
                    </Link>
                    <button type="button" className="notification-bell__dismiss" onClick={() => dismissOne(n.id)} aria-label="Dismiss">
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
