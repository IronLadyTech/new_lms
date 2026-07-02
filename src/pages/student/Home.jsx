import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getAssignments } from '../../services/courseService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../../services/announcementService';
import { enrollInCourse, getUserActivities } from '../../services/userService';
import { getEvents } from '../../services/eventService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import AnnouncementFeed from '../../components/AnnouncementFeed';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseThumbnail from '../../components/CourseThumbnail';
import EventPreviewCard from '../../components/EventPreviewCard';
import EventDetailActions from '../../components/EventDetailActions';
import HomeBannerCarousel from '../../components/HomeBannerCarousel';
import StreakAnalyticsModule from '../../components/analytics/StreakAnalyticsModule';

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

  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || '';
  const mbwCourse = enrolledCourses.find((c) => c.code === 'MBW');
  const soloEnrolled = enrolledCourses.length === 1 ? enrolledCourses[0] : null;

  const handleEnroll = async (courseId, courseTitle) => {
    if (!profile || isGuest) return;
    await enrollInCourse(user.uid, courseId, courseTitle);
    refreshProfile();
  };

  const scrollToCourses = useCallback(() => {
    document.getElementById('home-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="page home-page">
      <HomeBannerCarousel />

      {!isGuest && !loading && (
        <section className="home-welcome" aria-label="Welcome">
          <div className="home-welcome__copy">
            <p className="home-welcome__eyebrow">{timeGreeting()}</p>
            <h1 className="home-welcome__title">{firstName ? `${firstName}` : 'Welcome back'}</h1>
            <p className="home-welcome__sub">
              {enrolledCourses.length > 0
                ? 'Pick up where you left off or explore your programs below.'
                : 'Browse programs below and enroll to start learning.'}
            </p>
          </div>
          {mbwCourse ? (
            <Link to="/app/mbw" className="btn btn-primary home-welcome__cta">
              Continue MBW tasks
            </Link>
          ) : soloEnrolled ? (
            <Link
              to={soloEnrolled.code === 'MBW' ? '/app/mbw' : `/app/course/${soloEnrolled.id}`}
              className="btn btn-primary home-welcome__cta"
            >
              Continue {soloEnrolled.code}
            </Link>
          ) : (
            <button type="button" className="btn btn-primary home-welcome__cta" onClick={scrollToCourses}>
              Browse courses
            </button>
          )}
        </section>
      )}

      <section id="home-courses" className="section home-courses-section">
        <h2 className="home-section-title">Courses</h2>
        <p className="page-sub">MBW &amp; LEP programs — tap to open or enroll</p>

        {isGuest ? (
          <GuestLockedPanel title="Courses locked" />
        ) : loading ? (
          <p className="muted">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="muted">No courses yet. Ask your admin to add courses from the admin panel.</p>
        ) : (
          <div className="course-grid">
            {sortedCourses.map((course) => {
              const isEnrolled = enrolled.includes(course.id);
              return (
                <article key={course.id} className="course-card">
                  <CourseThumbnail course={course} size="card" />
                  <div className="course-card__body">
                    <div className={`course-card__badge course-card__badge--${(course.code || '').toLowerCase()}`}>
                      {course.code}
                    </div>
                    <h3 className="course-card__title">{course.title}</h3>
                    <p className="course-card__desc">{course.description}</p>
                    <div className="course-card__actions">
                      {isEnrolled ? (
                        course.code === 'MBW' ? (
                          <Link to="/app/mbw" className="btn btn-primary btn-sm">
                            Open tasks
                          </Link>
                        ) : (
                          <Link to={`/app/course/${course.id}`} className="btn btn-primary btn-sm">
                            Continue
                          </Link>
                        )
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEnroll(course.id, course.title)}
                        >
                          Enroll
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!isGuest && announcements.length > 0 && (
        <section className="section announcement-section">
          <h2 className="home-section-title">Announcements</h2>
          <AnnouncementFeed announcements={announcements} userId={user.uid} />
        </section>
      )}

      {!isGuest && !loading && (
        <>
          <section className="section home-secondary">
            <h2 className="home-section-title">Last activity</h2>
            {activities.length === 0 ? (
              <p className="muted">No activity yet. Open a course and start a lesson.</p>
            ) : (
              <ActivityLogList activities={activities} courseMap={courseMap} />
            )}
          </section>

          <section className="section home-secondary">
            <h2 className="home-section-title">
              Upcoming events · <Link to="/app/calendar">View calendar</Link>
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="muted">No upcoming events scheduled.</p>
            ) : (
              <ul className="list-cards list-cards--events">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="event-preview-list__item">
                    <EventPreviewCard event={ev} />
                    <EventDetailActions event={ev} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section home-secondary">
            <h2 className="home-section-title">Pending assignments</h2>
            {pendingAssignments.length === 0 ? (
              <p className="muted">All caught up!</p>
            ) : (
              <ul className="list-cards">
                {pendingAssignments.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <span className="muted"> — {a.courseTitle}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {user?.uid && (
            <section className="section home-analytics-section">
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
