import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getAssignments } from '../../services/courseService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../../services/announcementService';
import { enrollInCourse, getUserActivities } from '../../services/userService';
import { getEvents } from '../../services/eventService';
import AnnouncementFeed from '../../components/AnnouncementFeed';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseThumbnail from '../../components/CourseThumbnail';
import CourseCard from '../../components/home/CourseCard';
import HomeBannerCarousel from '../../components/HomeBannerCarousel';
import StreakAnalyticsModule from '../../components/analytics/StreakAnalyticsModule';
import HomeDashboardHero, { HomeDashboardHeroCta } from '../../components/home/HomeDashboardHero';
import HomeQuickStats from '../../components/home/HomeQuickStats';
import HomeContinueCard from '../../components/home/HomeContinueCard';
import HomeSchedulePanel from '../../components/home/HomeSchedulePanel';
import GuestHomePreview from '../../components/home/GuestHomePreview';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import useTaskEngine from '../../hooks/useTaskEngine';
import {
  computeSectionProgress,
  getTotalMilestones,
  getCompletedMilestones,
} from '../../utils/mbwProgramUtils';
import { getProgramTasksPath } from '../../utils/programTaskRoutes';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user, profile, refreshProfile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    (async () => {
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuest, user?.uid, profile?.enrolledCourses]);

  useEffect(() => {
    if (loading || window.location.hash !== '#courses') return;
    const timer = window.setTimeout(() => {
      document.getElementById('home-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const enrolled = profile?.enrolledCourses || [];
  const enrolledCourses = useMemo(
    () => courses.filter((c) => enrolled.includes(c.id)),
    [courses, enrolled]
  );
  const sortedCourses = useMemo(
    () =>
      [...courses].sort(
        (a, b) => Number(enrolled.includes(b.id)) - Number(enrolled.includes(a.id))
      ),
    [courses, enrolled]
  );

  const { isEnrolled: mbwEnrolled } = useMbwEnrollment();
  const engine = useTaskEngine(mbwEnrolled && !isGuest ? user?.uid : null);
  const mbwProgress = useMemo(() => {
    if (!mbwEnrolled) return null;
    const sp = computeSectionProgress(engine.taskStates, profile);
    const total = getTotalMilestones(sp);
    const completed = getCompletedMilestones(sp);
    if (!total) return null;
    return {
      pct: Math.round((completed / total) * 100),
      label: `${completed} of ${total} milestones`,
    };
  }, [mbwEnrolled, engine.taskStates, profile]);

  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || '';
  const mbwCourse = enrolledCourses.find((c) => c.code === 'MBW');
  const soloEnrolled = enrolledCourses.length === 1 ? enrolledCourses[0] : null;
  const continueCourse = mbwCourse || soloEnrolled || enrolledCourses[0] || null;

  const handleEnroll = async (courseId, courseTitle) => {
    if (!profile || isGuest) return;
    await enrollInCourse(user.uid, courseId, courseTitle);
    refreshProfile();
  };

  const scrollToCourses = useCallback(() => {
    document.getElementById('home-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const heroSubline =
    enrolledCourses.length > 0
      ? 'Pick up where you left off or explore your programs below.'
      : 'Browse programs below and enroll to start learning.';

  const heroCta = mbwCourse ? (
    <HomeDashboardHeroCta to="/app/mbw">Continue MBW tasks</HomeDashboardHeroCta>
  ) : soloEnrolled ? (
    <HomeDashboardHeroCta
      to={getProgramTasksPath(soloEnrolled.code) || `/app/course/${soloEnrolled.id}`}
    >
      Continue {soloEnrolled.code}
    </HomeDashboardHeroCta>
  ) : (
    <HomeDashboardHeroCta onClick={scrollToCourses}>Browse programs</HomeDashboardHeroCta>
  );

  const quickStats = [
    {
      id: 'programs',
      label: 'Programs',
      value: enrolledCourses.length,
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

  return (
    <div className="page home-page dashboard-page">
      <HomeBannerCarousel />

      {!isGuest && loading && <DashboardSkeleton />}

      {!isGuest && !loading && (
        <div className="dashboard-shell">
          <HomeDashboardHero
            greeting={timeGreeting()}
            firstName={firstName}
            program={profile?.program}
            subline={heroSubline}
            cta={heroCta}
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
              enrolledCount={enrolledCourses.length}
              progress={continueCourse?.code === 'MBW' ? mbwProgress : null}
            />
            <HomeSchedulePanel events={upcomingEvents} />
          </div>
        </div>
      )}

      <section id="home-courses" className="section dashboard-programs">
        <h2 className="home-section-title">Your programs</h2>
        <p className="page-sub">MBW, LEP &amp; 100BM — open or enroll to begin</p>

        {isGuest ? (
          <GuestHomePreview />
        ) : loading ? (
          <p className="muted">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="muted">No courses yet. Ask your admin to add courses from the admin panel.</p>
        ) : (
          <div className="course-grid course-grid--rich">
            {sortedCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isEnrolled={enrolled.includes(course.id)}
                onEnroll={handleEnroll}
                progress={course.code === 'MBW' ? mbwProgress : null}
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
                courses={enrolledCourses}
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
