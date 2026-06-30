import { useEffect, useMemo, useState } from 'react';
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
          getUserActivities(user.uid, 1),
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

  const handleEnroll = async (courseId, courseTitle) => {
    if (!profile || isGuest) return;
    await enrollInCourse(user.uid, courseId, courseTitle);
    refreshProfile();
  };

  return (
    <div className="page home-page">
      <HomeBannerCarousel />

      {!isGuest && user?.uid && (
        <section className="section home-analytics-section">
          <StreakAnalyticsModule learnerId={user.uid} courses={enrolledCourses} showBrowseLink={false} />
        </section>
      )}

      <h1 id="home-courses">Courses</h1>
      <p className="page-sub">MBW & LEP programs — tap to open or enroll</p>

      {!isGuest && enrolledCourses.some((c) => c.code === 'MBW') && (
        <section className="section mbw-dash-card">
          <h2>MBW Pre-Session Tasks</h2>
          <p className="mbw-dash-card__text">
            Continue your Iron Lady MBW journey — complete tasks in order and track your progress.
          </p>
          <Link to="/app/mbw" className="btn btn-primary btn-sm">
            Open MBW tasks →
          </Link>
        </section>
      )}

      {!isGuest && announcements.length > 0 && (
        <section className="section announcement-section">
          <h2>Announcements</h2>
          <AnnouncementFeed announcements={announcements} userId={user.uid} />
        </section>
      )}

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
                  <div className="course-card__badge">{course.code}</div>
                  <h2>{course.title}</h2>
                  <p>{course.description}</p>
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

      {!isGuest && (
        <>
          <section className="section">
            <h2>Last activity</h2>
            {activities.length === 0 ? (
              <p className="muted">No activity yet. Start a lesson!</p>
            ) : (
              <ActivityLogList activities={activities.slice(0, 1)} courseMap={courseMap} />
            )}
          </section>

          <section className="section">
            <h2>
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

          <section className="section">
            <h2>Pending assignments</h2>
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
        </>
      )}

    </div>
  );
}
