/*
 * Home (next) — the parallel rebuild of the learner dashboard.
 *
 * Served at /app/home-next while /app/home keeps serving the page everyone
 * uses. Nothing here is reachable from the navigation, so the two run side by
 * side until this one is tested and the route is switched over.
 *
 * The layout comes from the Stitch prototype in stitch-home/. The data does
 * not: every figure on this page is read from the same services Home.jsx
 * already uses, so this adds no Firestore reads and no new collections.
 *
 * Three panels from the prototype are deliberately absent — certificates,
 * achievements and hours spent. Nothing in this product issues a certificate,
 * awards a badge, ranks learners or records time, so those panels could only
 * have shown invented numbers. They come back when the features behind them
 * exist.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardList, Flame, Layers, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import { getEvents } from '../../services/eventService';
import { resolveVisibleEvents } from '../../utils/eventVisibility';
import useModeratedBatchIds from '../../hooks/useModeratedBatchIds';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import useTaskEngine from '../../hooks/useTaskEngine';
import useBm100TaskEngine from '../../hooks/useBm100TaskEngine';
import { useStreakAnalytics } from '../../hooks/useStreakAnalytics';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseCard from '../../components/home/CourseCard';
import HomeDashboardHero from '../../components/home/HomeDashboardHero';
import HomeContinueCard from '../../components/home/HomeContinueCard';
import GuestHomePreview from '../../components/home/GuestHomePreview';
import EventPreviewCard from '../../components/EventPreviewCard';
import EventDetailActions from '../../components/EventDetailActions';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import {
  computeSectionProgress,
  getTotalMilestones,
  getCompletedMilestones,
  countPendingTasks,
} from '../../utils/mbwProgramUtils';
import {
  canAccessProgram,
  getContinueProgram,
  getProgramAccessState,
  sortCoursesForDashboard,
} from '../../utils/programAccess';
import { PROGRAMS } from '../../data/programTypes';
import '../../styles/homeNext.css';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Submissions logged in the last seven days, counted from the streak events
 * the analytics module already loads. Not "lessons completed" — this product
 * has no completion state — so the label says submissions, which is what the
 * number actually counts.
 */
function countThisWeek(dailyCounts = []) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const key = cutoff.toLocaleDateString('en-CA');
  return dailyCounts.reduce((sum, d) => (d.date >= key ? sum + (d.count || 0) : sum), 0);
}

function Stat({ icon: Icon, value, unit, label, live = false }) {
  return (
    <div className="hn-stat">
      <span className={`hn-stat__icon${live ? ' hn-stat__icon--live' : ''}`} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div>
        <p className="hn-stat__figure">
          <span className="hn-stat__value">{value}</span>
          <span className="hn-stat__unit">{unit}</span>
        </p>
        <p className="hn-stat__label">{label}</p>
      </div>
    </div>
  );
}

export default function HomeNext() {
  const { user, profile, isGuest, role } = useAuth();
  const { batchIds: moderatedBatchIds } = useModeratedBatchIds();
  /* The array is a fresh identity every render; depending on it directly
     would reload the dashboard in a loop. */
  const moderatedKey = moderatedBatchIds.join(',');

  const [courses, setCourses] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [activities, setActivities] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    (async () => {
      setLoadError('');
      try {
        const [list, acts, events] = await Promise.all([
          getCourses(),
          getUserActivities(user.uid, 5),
          getEvents(),
        ]);
        if (cancelled) return;

        setCourses(list);
        setCourseMap(buildCourseMap(list));
        setActivities(acts);

        const today = new Date().toLocaleDateString('en-CA');
        /* Batch sessions belong to one cohort. Unscoped, one batch's schedule
           would appear on every learner's dashboard. */
        const visible = resolveVisibleEvents(events, {
          role,
          batchId: profile?.batchId || '',
          moderatedBatchIds,
        });
        /* The rail has room for a few, unlike the single slot on Home. */
        setUpcomingEvents(visible.filter((e) => e.date >= today).slice(0, 3));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadError('We could not load your dashboard. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    /* batchId, role and the moderated batches all decide which sessions are
       visible, and all arrive after the first render. */
  }, [
    isGuest,
    user?.uid,
    profile?.enrolledCourses,
    profile?.batchId,
    role,
    moderatedKey,
    reloadKey,
  ]);

  const sortedCourses = useMemo(
    () => sortCoursesForDashboard(courses, profile),
    [courses, profile]
  );
  const accessibleCourses = useMemo(
    () => courses.filter((c) => canAccessProgram(c.code, profile, courses)),
    [courses, profile]
  );

  const { isEnrolled: mbwEnrolled } = useMbwEnrollment();
  const canOpenMbw = canAccessProgram(PROGRAMS.MBW, profile, courses) || mbwEnrolled;
  const engine = useTaskEngine(canOpenMbw && !isGuest ? user?.uid : null);

  const canOpenBm100 = canAccessProgram(PROGRAMS.BM100, profile, courses);
  const bm100Engine = useBm100TaskEngine(canOpenBm100 && !isGuest ? user?.uid : null);

  const { summary: streak } = useStreakAnalytics(isGuest ? null : user?.uid);

  const pendingTaskCount = useMemo(
    () => countPendingTasks(engine.taskStates) + countPendingTasks(bm100Engine.taskStates),
    [engine.taskStates, bm100Engine.taskStates]
  );

  const mbwProgress = useMemo(() => {
    if (!canOpenMbw) return null;
    const sp = computeSectionProgress(engine.taskStates, profile);
    const total = getTotalMilestones(sp);
    const completed = getCompletedMilestones(sp);
    if (!total) return null;
    return {
      pct: Math.round((completed / total) * 100),
      label: `${completed} of ${total} milestones`,
    };
  }, [canOpenMbw, engine.taskStates, profile]);

  const doneThisWeek = countThisWeek(streak?.dailyCounts);
  const currentStreak = streak?.currentStreak || 0;

  const firstName =
    String(profile?.displayName ?? '')
      .trim()
      .split(/\s+/)[0] || '';
  const continueCourse = getContinueProgram(profile, courses) || accessibleCourses[0] || null;
  const mbwCourse = canOpenMbw ? courses.find((c) => c.code === 'MBW') || null : null;

  const heroSubline =
    accessibleCourses.length > 0
      ? 'Pick up where you left off — only your enrolled programs are unlocked.'
      : 'Your Iron Lady path is LEP → 100BM → MBW. Explore each program below to learn more.';

  const retryLoad = () => {
    setLoadError('');
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (isGuest) {
    return (
      <div className="page home-page dashboard-page">
        <GuestHomePreview />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page home-page dashboard-page">
        <DashboardSkeleton />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page home-page dashboard-page">
        <EmptyState
          icon={RefreshCw}
          title="Dashboard unavailable"
          message={loadError}
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={retryLoad}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page home-page dashboard-page">
      <HomeDashboardHero greeting={timeGreeting()} firstName={firstName} subline={heroSubline} />

      <div className="hn-columns">
        <div className="hn-main">
          {/* Resume first: a returning learner's intent is almost always
              "carry on from where I stopped". */}
          <HomeContinueCard
            course={continueCourse}
            nextLabel={
              mbwCourse
                ? 'Master of Business Warfare — quarterly leadership journey'
                : continueCourse?.description?.slice(0, 80)
            }
            enrolledCount={accessibleCourses.length}
            progress={continueCourse?.code === 'MBW' ? mbwProgress : null}
          />

          <section className="hn-section" aria-labelledby="hn-stats-title">
            <div className="hn-section__head">
              <h2 id="hn-stats-title" className="hn-section-title">
                My statistics
              </h2>
            </div>

            <div className="hn-stats">
              <Stat
                icon={Layers}
                value={accessibleCourses.length}
                unit={`of ${courses.length}`}
                label="Programmes unlocked"
              />
              <Stat
                icon={ClipboardList}
                value={pendingTaskCount}
                unit={pendingTaskCount === 1 ? 'task' : 'tasks'}
                label="Waiting on you"
                live
              />
              <Stat
                icon={CalendarDays}
                value={doneThisWeek}
                unit={doneThisWeek === 1 ? 'submission' : 'submissions'}
                label="Done this week"
              />
              <Stat
                icon={Flame}
                value={currentStreak}
                unit={currentStreak === 1 ? 'day' : 'days'}
                label="Current streak"
              />
            </div>
          </section>

          <section className="hn-section" id="home-courses" aria-labelledby="hn-programs-title">
            <div className="hn-section__head">
              <h2 id="hn-programs-title" className="hn-section-title">
                Your programs
              </h2>
            </div>

            {courses.length === 0 ? (
              <p className="muted">
                No courses yet. Ask your admin to add courses from the admin panel.
              </p>
            ) : (
              <div className="course-grid course-grid--rich">
                {sortedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    access={getProgramAccessState(course.code, profile, courses)}
                    progress={course.code === 'MBW' && canOpenMbw ? mbwProgress : null}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="hn-section" aria-labelledby="hn-activity-title">
            <div className="hn-section__head">
              <h2 id="hn-activity-title" className="hn-section-title">
                Recent activity
              </h2>
            </div>

            {activities.length === 0 ? (
              <p className="muted">No activity yet. Open a program and start a lesson.</p>
            ) : (
              <ActivityLogList activities={activities} courseMap={courseMap} />
            )}
          </section>
        </div>

        {/*
          One heading for the column, with its link beside it. The prototype
          named this section twice — once as the column and again inside the
          card under it.
        */}
        <aside className="hn-rail" aria-labelledby="hn-events-title">
          <div className="hn-rail__head">
            <h2 id="hn-events-title" className="hn-rail__title">
              Events
            </h2>
            <Link to="/app/calendar" className="hn-rail__link">
              View all <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="hn-rail__empty">No live sessions scheduled — check back soon.</p>
          ) : (
            <ul className="hn-rail__list">
              {upcomingEvents.map((ev) => (
                <li key={ev.id} className="hn-rail__item">
                  <EventPreviewCard event={ev} />
                  <EventDetailActions event={ev} compact />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
