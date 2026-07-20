import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  MessageCircle,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEvents } from '../services/eventService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../services/announcementService';
import { getUserTickets, statusLabel, TICKET_STATUSES } from '../services/ticketService';
import { getUserSubmissions as getMbwSubmissions, getStaticTasks as getMbwTasks } from '../services/mbwService';
import { getUserSubmissions as getBm100Submissions, getStaticTasks as getBm100Tasks } from '../services/bm100Service';
import { PROGRAMS } from '../data/programTypes';
import { getReviewOutcomeMeta } from '../utils/submissionReview';
import { calendarEventUrl } from './EventPreviewCard';
import { useFocusTrap } from '../hooks/useFocusTrap';

const DISMISSED_KEY = 'ilms_dismissed_notifications';

const KIND_LABELS = {
  review: 'Review',
  event: 'Event',
  ticket: 'Support',
  assigned: 'Support',
  announcement: 'News',
};

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

function useSwipeDismiss(onDismiss) {
  const startX = useRef(null);

  return {
    onTouchStart: (event) => {
      startX.current = event.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (event) => {
      if (startX.current == null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX.current;
      if (startX.current - endX > 72) onDismiss();
      startX.current = null;
    },
  };
}

function reviewedAtKey(ts) {
  if (!ts) return '';
  if (typeof ts === 'string') return ts;
  if (ts.seconds) return String(ts.seconds);
  if (ts.toMillis) return String(ts.toMillis());
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

function buildNotifications(events, tickets, announcements, reviews, userId) {
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

  reviews.slice(0, 12).forEach((r) => {
    const meta = getReviewOutcomeMeta(r.outcome);
    const statusLabelText = meta?.learnerLabel || 'Reviewed';
    items.push({
      id: `review-${r.taskId}-${reviewedAtKey(r.reviewedAt)}`,
      kind: 'review',
      title: `Review: ${r.taskTitle}`,
      body: r.feedback
        ? `${statusLabelText} — ${r.feedback.slice(0, 90)}`
        : `${statusLabelText}. Open the task to see details.`,
      link: r.link,
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

function buildReviewItems(submissionsMap, tasks, program) {
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const basePath = program === PROGRAMS.BM100 ? '/app/100bm' : '/app/mbw';

  return Object.values(submissionsMap || {})
    .filter((s) => s?.reviewedAt && (s.reviewOutcome || s.feedback))
    .map((s) => ({
      taskId: s.taskId,
      taskTitle: taskById[s.taskId]?.title || s.taskId,
      outcome: s.reviewOutcome,
      feedback: s.feedback || '',
      reviewedAt: s.reviewedAt,
      link: `${basePath}?lesson=${encodeURIComponent(s.taskId)}`,
    }))
    .sort((a, b) => reviewedAtKey(b.reviewedAt).localeCompare(reviewedAtKey(a.reviewedAt)));
}

function NotificationListItem({ notification, onDismiss, onNavigate }) {
  const swipe = useSwipeDismiss(onDismiss);

  return (
    <li
      className={`notification-bell__item notification-bell__item--${notification.kind}`}
      {...swipe}
    >
      <Link to={notification.link} className="notification-bell__link" onClick={onNavigate}>
        <span className="notification-bell__item-icon">
          {notification.kind === 'event' && <CalendarDays size={18} />}
          {notification.kind === 'assigned' && <UserCheck size={18} />}
          {notification.kind === 'ticket' && <MessageCircle size={18} />}
          {notification.kind === 'announcement' && <Megaphone size={18} />}
          {notification.kind === 'review' && <ClipboardCheck size={18} />}
        </span>
        <span className="notification-bell__item-copy">
          <span className="notification-bell__item-top">
            <span className="notification-bell__kind">{KIND_LABELS[notification.kind] || 'Update'}</span>
            <strong>{notification.title}</strong>
          </span>
          {notification.body ? (
            <span className="notification-bell__body-text muted">{notification.body}</span>
          ) : null}
        </span>
      </Link>
      <button
        type="button"
        className="notification-bell__dismiss"
        onClick={onDismiss}
        aria-label={`Dismiss ${notification.title}`}
      >
        <X size={16} />
      </button>
    </li>
  );
}

export default function NotificationBell() {
  const { user, profile, isGuest } = useAuth();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [dismissed, setDismissedState] = useState(getDismissed);
  const panelRef = useRef(null);
  const closeNotifications = () => setOpen(false);

  useFocusTrap(open, panelRef, { onEscape: closeNotifications });

  useEffect(() => {
    if (!user || isGuest) return undefined;
    let cancelled = false;
    const program = profile?.program || PROGRAMS.MBW;

    const load = async () => {
      try {
        const getSubs = program === PROGRAMS.BM100 ? getBm100Submissions : getMbwSubmissions;
        const tasks = program === PROGRAMS.BM100 ? getBm100Tasks() : getMbwTasks();
        const [ev, tk, ann, subs] = await Promise.all([
          getEvents(),
          getUserTickets(user.uid),
          getAnnouncements(),
          getSubs(user.uid),
        ]);
        if (!cancelled) {
          setEvents(ev);
          setTickets(tk);
          setAnnouncements(ann);
          setReviews(buildReviewItems(subs, tasks, program));
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
  }, [user, isGuest, profile?.program]);

  const notifications = useMemo(
    () => buildNotifications(events, tickets, announcements, reviews, user?.uid),
    [events, tickets, announcements, reviews, user?.uid]
  );
  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  const count = visible.length;

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add('notification-sheet-open');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('notification-sheet-open');
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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

  const overlay = open
    ? createPortal(
        <div className="notification-bell__overlay-root">
          <button
            type="button"
            className="notification-bell__backdrop"
            onClick={closeNotifications}
            aria-label="Close notifications"
          />
          <div
            className="notification-bell__panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
          >
            <div className="notification-bell__sheet-handle" aria-hidden />
            <div className="notification-bell__head">
              <div className="notification-bell__head-text">
                <strong>Notifications</strong>
                {count > 0 && (
                  <span className="notification-bell__head-count muted">{count} new</span>
                )}
              </div>
              <div className="notification-bell__head-actions">
                {count > 0 && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={dismissAll}>
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  className="notification-bell__close"
                  onClick={closeNotifications}
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="notification-bell__body">
              <ul className="notification-bell__list">
                {visible.length === 0 ? (
                  <li className="notification-bell__empty muted">No new notifications.</li>
                ) : (
                  visible.map((n) => (
                    <NotificationListItem
                      key={n.id}
                      notification={n}
                      onDismiss={() => dismissOne(n.id)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`notification-bell${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? `, ${count} new` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={2} />
        {count > 0 && <span className="notification-bell__badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {overlay}
    </div>
  );
}
