import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import { enrollInCourse } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';

export default function Home() {
  const { user, profile, refreshProfile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const list = await getCourses();
        setCourses(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isGuest]);

  const enrolled = profile?.enrolledCourses || [];

  const handleEnroll = async (courseId) => {
    if (!profile || isGuest) return;
    await enrollInCourse(user.uid, courseId);
    refreshProfile();
  };

  return (
    <div className="page home-page">
      <h1>Courses</h1>
      <p className="page-sub">MBW & LEP programs — tap to open or enroll</p>

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
                      onClick={() => handleEnroll(course.id)}
                    >
                      Enroll
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
