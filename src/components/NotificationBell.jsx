import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  MessageCircle,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRecentEventsForNotifications } from '../services/eventService';
import {
  getActiveAnnouncements,
  getActiveAnnouncementsForUser,
} from '../services/announcementService';
import { getUserTickets, statusLabel, TICKET_STATUSES } from '../services/ticketService';
import {
  getUserSubmissions as getMbwSubmissions,
  getStaticTasks as getMbwTasks,
} from '../services/mbwService';
import {
  getUserSubmissions as getBm100Submissions,
  getStaticTasks as getBm100Tasks,
} from '../services/bm100Service';
import { PROGRAMS } from '../data/programTypes';
import { getReviewOutcomeMeta, getSubmissionReviewHistory } from '../utils/submissionReview';
import { calendarEventUrl } from './EventPreviewCard';
import { useFocusTrap } from '../hooks/useFocusTrap';

const DISMISSED_KEY = 'ilms_dismissed_notifications';
const NOTIFICATION_POLL_MS = 5 * 60 * 1000;

function safeText(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

function safeSlice(value, max) {
  return safeText(value).slice(0, max);
}

const KIND_LABELS = {
  review: 'Review',
  event: 'Event',
  ticket: 'Support',
  assigned: 'Support',
  announcement: 'News',
};

function getDismissed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setDismissed(ids) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    /* quota / private mode */
  }
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
  try {
    const safeEvents = Array.isArray(events) ? events : [];
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const today = new Date().toISOString().slice(0, 10);
    const items = [];

    getActiveAnnouncementsForUser(safeAnnouncements, userId)
      .slice(0, 10)
      .forEach((a) => {
        const tagged = Array.isArray(a.taggedUserIds) && a.taggedUserIds.includes(userId);
        items.push({
          id: `announcement-${a.id}`,
          kind: 'announcement',
          title: safeText(a.title) || 'Announcement',
          body: tagged ? `${safeSlice(a.body, 80)} · You're tagged` : safeSlice(a.body, 100),
          link: '/app/home',
        });
      });

    safeReviews.slice(0, 12).forEach((r) => {
      const meta = getReviewOutcomeMeta(r.outcome);
      const statusLabelText = meta?.learnerLabel || 'Reviewed';
      items.push({
        id: `review-${r.taskId}-${reviewedAtKey(r.reviewedAt)}`,
        kind: 'review',
        title: `Review: ${safeText(r.taskTitle) || 'Task'}`,
        body: r.feedback
          ? `${statusLabelText} — ${safeSlice(r.feedback, 90)}`
          : `${statusLabelText}. Open the task to see details.`,
        link: r.link || '/app/home',
      });
    });

    safeEvents
      .filter((e) => e?.date && e.date >= today)
      .slice(0, 8)
      .forEach((ev) => {
        items.push({
          id: `event-${ev.id || ev.date}`,
          kind: 'event',
          title: safeText(ev.title) || 'Event',
          body: `${ev.date}${ev.time ? ` · ${ev.time}` : ''}${ev.type ? ` · ${ev.type}` : ''}`,
          link: calendarEventUrl(ev),
        });
      });

    safeTickets
      .filter((t) => t?.status !== TICKET_STATUSES.RESOLVED)
      .slice(0, 10)
      .forEach((t) => {
        const subject = safeText(t.subject) || 'Support request';
        if (t.status === TICKET_STATUSES.ASSIGNED) {
          items.push({
            id: `ticket-assigned-${t.id}`,
            kind: 'assigned',
            title: 'Ticket assigned',
            body: t.assignedToName
              ? `"${subject}" is now with ${t.assignedToName}.`
              : `"${subject}" has been assigned to support staff.`,
            link: '/app/support',
          });
        } else {
          items.push({
            id: `ticket-open-${t.id}`,
            kind: 'ticket',
            title: subject,
            body: `Support ticket · ${statusLabel(t.status)}`,
            link: '/app/support',
          });
        }
      });

    return items;
  } catch (err) {
    console.warn('NotificationBell: buildNotifications failed', err);
    return [];
  }
}

function buildReviewItems(submissionsMap, tasks, program) {
  try {
    const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const basePath = program === PROGRAMS.BM100 ? '/app/100bm' : '/app/mbw';
    const items = [];

    Object.values(submissionsMap || {}).forEach((s) => {
      if (!s?.taskId) return;
      const history = getSubmissionReviewHistory(s);
      history.forEach((entry) => {
        items.push({
          taskId: s.taskId,
          taskTitle: taskById[s.taskId]?.title || s.taskId,
          outcome: entry.outcome,
          feedback: safeText(entry.feedback),
          reviewedAt: entry.reviewedAt,
          link: `${basePath}?lesson=${encodeURIComponent(s.taskId)}`,
        });
      });
    });

    return items.sort((a, b) =>
      reviewedAtKey(b.reviewedAt).localeCompare(reviewedAtKey(a.reviewedAt))
    );
  } catch (err) {
    console.warn('NotificationBell: could not build review notifications', err);
    return [];
  }
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
            <span className="notification-bell__kind">
              {KIND_LABELS[notification.kind] || 'Update'}
            </span>
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
          getRecentEventsForNotifications(),
          getUserTickets(user.uid),
          getActiveAnnouncements(),
          getSubs(user.uid),
        ]);
        if (!cancelled) {
          setEvents(Array.isArray(ev) ? ev : []);
          setTickets(Array.isArray(tk) ? tk : []);
          setAnnouncements(Array.isArray(ann) ? ann : []);
          setReviews(buildReviewItems(subs, tasks, program));
        }
      } catch (e) {
        console.error('NotificationBell refresh failed:', e);
      }
    };

    load();
    const interval = setInterval(load, NOTIFICATION_POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, isGuest, profile?.program]);

  useEffect(() => {
    if (!open || !user || isGuest) return undefined;
    let cancelled = false;
    const program = profile?.program || PROGRAMS.MBW;

    (async () => {
      try {
        const getSubs = program === PROGRAMS.BM100 ? getBm100Submissions : getMbwSubmissions;
        const tasks = program === PROGRAMS.BM100 ? getBm100Tasks() : getMbwTasks();
        const [ev, tk, ann, subs] = await Promise.all([
          getRecentEventsForNotifications(),
          getUserTickets(user.uid),
          getActiveAnnouncements(),
          getSubs(user.uid),
        ]);
        if (!cancelled) {
          setEvents(Array.isArray(ev) ? ev : []);
          setTickets(Array.isArray(tk) ? tk : []);
          setAnnouncements(Array.isArray(ann) ? ann : []);
          setReviews(buildReviewItems(subs, tasks, program));
        }
      } catch (e) {
        console.error('NotificationBell open refresh failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user, isGuest, profile?.program]);

  const notifications = useMemo(() => {
    try {
      return buildNotifications(events, tickets, announcements, reviews, user?.uid);
    } catch (err) {
      console.warn('NotificationBell: failed to build notifications', err);
      return [];
    }
  }, [events, tickets, announcements, reviews, user?.uid]);
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
              {visible.length === 0 ? (
                <div className="notification-bell__empty">
                  <span className="notification-bell__empty-icon" aria-hidden>
                    <BellOff size={26} strokeWidth={1.75} />
                  </span>
                  <p className="notification-bell__empty-title">You&apos;re all caught up</p>
                  <p className="notification-bell__empty-text muted">
                    Updates about your tasks, events, and support requests will show up here.
                  </p>
                </div>
              ) : (
                <ul className="notification-bell__list">
                  {visible.map((n) => (
                    <NotificationListItem
                      key={n.id}
                      notification={n}
                      onDismiss={() => dismissOne(n.id)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </ul>
              )}
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
