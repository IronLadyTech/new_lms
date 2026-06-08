import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { getAnnouncements, getActiveAnnouncementsForUser } from '../../services/announcementService';
import { enrollInCourse } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import AnnouncementFeed from '../../components/AnnouncementFeed';
import CourseThumbnail from '../../components/CourseThumbnail';

export default function Home() {
  const { user, profile, refreshProfile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const [list, allAnnouncements] = await Promise.all([getCourses(), getAnnouncements()]);
        setCourses(list);
        setAnnouncements(getActiveAnnouncementsForUser(allAnnouncements, user.uid));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isGuest, user?.uid]);

  const enrolled = profile?.enrolledCourses || [];

  const handleEnroll = async (courseId, courseTitle) => {
    if (!profile || isGuest) return;
    await enrollInCourse(user.uid, courseId, courseTitle);
    refreshProfile();
  };

  return (
    <div className="page home-page">
      <h1>Courses</h1>
      <p className="page-sub">MBW & LEP programs — tap to open or enroll</p>

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
          {courses.map((course) => {
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
                      <Link to={`/app/course/${course.id}`} className="btn btn-primary btn-sm">
                        Continue
                      </Link>
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
    </div>
  );
}
