import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getAssignments } from '../../services/courseService';
import {
  getAnnouncements,
  getActiveAnnouncementsForUser,
} from '../../services/announcementService';
import { getUserActivities } from '../../services/userService';
import { getEvents } from '../../services/eventService';
import AnnouncementFeed from '../../components/AnnouncementFeed';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseCard from '../../components/home/CourseCard';
import HomeBannerCarousel from '../../components/HomeBannerCarousel';
import StreakAnalyticsModule from '../../components/analytics/StreakAnalyticsModule';
import HomeDashboardHero from '../../components/home/HomeDashboardHero';
import HomeQuickStats from '../../components/home/HomeQuickStats';
import HomeContinueCard from '../../components/home/HomeContinueCard';
import HomeSchedulePanel from '../../components/home/HomeSchedulePanel';
import GuestHomePreview from '../../components/home/GuestHomePreview';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import { RefreshCw } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import useTaskEngine from '../../hooks/useTaskEngine';
import {
  computeSectionProgress,
  getTotalMilestones,
  getCompletedMilestones,
} from '../../utils/mbwProgramUtils';
import {
  canAccessProgram,
  getContinueProgram,
  getProgramAccessState,
  sortCoursesForDashboard,
} from '../../utils/programAccess';
import { PROGRAMS } from '../../data/programTypes';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user, profile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
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
        const [list, allAnnouncements, acts, events] = await Promise.all([
          getCourses(),
          getAnnouncements(),
          getUserActivities(user.uid, 3),
          getEvents(),
        ]);
        if (cancelled) return;

        setCourses(list);
        setCourseMap(buildCourseMap(list));
        setAnnouncements(getActiveAnnouncementsForUser(allAnnouncements, user.uid));
        setActivities(acts);

        const today = new Date().toLocaleDateString('en-CA');
        setUpcomingEvents(events.filter((e) => e.date >= today).slice(0, 5));

        const enrolledList = list.filter((c) => profile?.enrolledCourses?.includes(c.id));
        const assignmentLists = await Promise.all(
          enrolledList.map((c) =>
            getAssignments(c.id).then((items) => items.map((a) => ({ ...a, courseTitle: c.title })))
          )
        );
        if (cancelled) return;
        setPendingAssignments(assignmentLists.flat().slice(0, 5));
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
  }, [isGuest, user?.uid, profile?.enrolledCourses, reloadKey]);

  useEffect(() => {
    if (loading || window.location.hash !== '#courses') return;
    const timer = window.setTimeout(() => {
      document
        .getElementById('home-courses')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const enrolled = profile?.enrolledCourses || [];
  const enrolledCourses = useMemo(
    () => courses.filter((c) => enrolled.includes(c.id)),
    [courses, enrolled]
  );
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

  const quickStats = [
    {
      id: 'programs',
      label: 'Open',
      value: accessibleCourses.length,
      hint: `of ${courses.length}`,
    },
    {
      id: 'pending',
      label: 'Pending',
      value: pendingAssignments.length,
      hint: 'assignments',
    },
    {
      id: 'events',
      label: 'Upcoming',
      value: upcomingEvents.length,
      hint: 'events',
    },
    {
      id: 'activity',
      label: 'Recent',
      value: activities.length,
      hint: 'actions',
    },
  ];

  const retryLoad = () => {
    setLoadError('');
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="page home-page dashboard-page">
      <HomeBannerCarousel />

      {!isGuest && loading && <DashboardSkeleton />}

      {!isGuest && !loading && loadError && (
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
      )}

      {!isGuest && !loading && !loadError && (
        <div className="dashboard-shell">
          <HomeDashboardHero
            greeting={timeGreeting()}
            firstName={firstName}
            program={profile?.program}
            subline={heroSubline}
          />

          <HomeQuickStats stats={quickStats} />

          <div className="dashboard-main-row">
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
            <HomeSchedulePanel events={upcomingEvents} />
          </div>
        </div>
      )}

      <section id="home-courses" className="section dashboard-programs">
        <h2 className="home-section-title">Your programs</h2>
        <p className="page-sub">
          Journey order: LEP → 100BM → MBW — locked programs stay visible as upcoming
        </p>

        {isGuest ? (
          <GuestHomePreview />
        ) : loading ? (
          <p className="muted">Loading courses…</p>
        ) : courses.length === 0 ? (
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

      {!isGuest && announcements.length > 0 && (
        <section className="section dashboard-secondary">
          <h2 className="home-section-title">Announcements</h2>
          <AnnouncementFeed announcements={announcements} userId={user.uid} />
        </section>
      )}

      {!isGuest && !loading && (
        <>
          <div className="dashboard-secondary-row">
            <section className="section dashboard-secondary">
              <h2 className="home-section-title">Last activity</h2>
              {activities.length === 0 ? (
                <p className="muted">No activity yet. Open a program and start a lesson.</p>
              ) : (
                <ActivityLogList activities={activities} courseMap={courseMap} />
              )}
            </section>

            {pendingAssignments.length > 0 && (
              <section className="section dashboard-secondary">
                <h2 className="home-section-title">Pending assignments</h2>
                <ul className="list-cards">
                  {pendingAssignments.map((a) => (
                    <li key={a.id}>
                      <strong>{a.title}</strong>
                      <span className="muted"> — {a.courseTitle}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {user?.uid && (
            <section className="section dashboard-progress">
              <h2 className="home-section-title">Your progress</h2>
              <StreakAnalyticsModule
                learnerId={user.uid}
                courses={accessibleCourses}
                showBrowseLink={false}
                homeVariant
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
