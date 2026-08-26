import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  LineChart,
  CalendarDays,
  MessageCircle,
  User,
  LogOut,
  FolderOpen,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEnrolledProgramEntries } from '../utils/programAccess';
import { getCourses } from '../services/courseService';

const TABS = [
  { to: '/app/home', label: 'Home', Icon: Home },
  { to: '/app/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/app/progress', label: 'Progress', Icon: LineChart },
  { to: '/app/support', label: 'Support', Icon: MessageCircle },
  { to: '/app/profile', label: 'Profile', Icon: User },
];

export default function BottomNav() {
  const { signOut, isGuest, profile } = useAuth();
  const { pathname } = useLocation();

  /*
   * The learner's programmes are the deepest content in the product and had no
   * nav entry at all — the only way in was finding the right card on Home. This
   * group is the way in.
   *
   * Enrolment has two sources and the profile is only one of them: a learner can
   * be enrolled purely through `enrolledCourses`, which is course ids, so the
   * course list is needed to read them. Deriving this from the profile alone
   * silently dropped a programme the learner was actually in. `getCourses` is
   * cached, so on a page that has already loaded it this costs no extra read.
   */
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    if (isGuest || !profile) return undefined;
    let cancelled = false;
    getCourses()
      .then((list) => {
        if (!cancelled) setCourses(list);
      })
      /* The nav must never be the thing that breaks a page: on failure the
         group simply does not appear. */
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isGuest, profile]);

  const programs = getEnrolledProgramEntries(profile, courses).filter((p) => p.tasksPath);
  const onProgramRoute = programs.some((p) => pathname.startsWith(p.tasksPath));
  const [open, setOpen] = useState(false);

  /* Courses arrive after the first paint, so the route match is not knowable
     when the state is initialised. Open the group once it becomes true — but
     never force it shut again, or a learner's own click would be undone. */
  useEffect(() => {
    if (onProgramRoute) setOpen(true);
  }, [onProgramRoute]);

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav__icon">
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}

      {/*
       * Sidebar only, both groups below. The mobile bar is a five-tab row and
       * a sixth item would take every target under the 44px minimum, so the
       * phone keeps the flat list it already had.
       */}
      {!isGuest && programs.length > 0 && (
        <div className="bottom-nav__group">
          <p className="bottom-nav__group-label">Learning</p>

          <button
            type="button"
            className={`bottom-nav__item bottom-nav__disclosure${onProgramRoute ? ' active' : ''}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="bottom-nav__icon">
              <FolderOpen size={20} strokeWidth={2} />
            </span>
            <span className="bottom-nav__label">My Courses</span>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={`bottom-nav__chevron${open ? ' bottom-nav__chevron--open' : ''}`}
              aria-hidden
            />
          </button>

          {open && (
            <ul className="bottom-nav__sublist">
              {programs.map((p) => (
                <li key={p.id}>
                  <NavLink
                    to={p.tasksPath}
                    className={({ isActive }) => `bottom-nav__subitem ${isActive ? 'active' : ''}`}
                  >
                    {p.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isGuest && (
        <button
          type="button"
          className="bottom-nav__item bottom-nav__item--footer"
          onClick={() => signOut()}
        >
          <span className="bottom-nav__icon">
            <LogOut size={20} strokeWidth={2} />
          </span>
          <span className="bottom-nav__label">Log out</span>
        </button>
      )}
    </nav>
  );
}
