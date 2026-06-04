import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCourses, seedDefaultCourses } from '../../services/courseService';
import { enrollInCourse } from '../../services/userService';

export default function Home() {
  const { user, profile, refreshProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let list = await getCourses();
        if (list.length === 0) list = await seedDefaultCourses();
        setCourses(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enrolled = profile?.enrolledCourses || [];

  const handleEnroll = async (courseId) => {
    if (!profile) return;
    await enrollInCourse(user.uid, courseId);
    refreshProfile();
  };

  return (
    <div className="page home-page">
      <h1>Courses</h1>
      <p className="page-sub">MBW & LEP programs — tap to open or enroll</p>

      {loading ? (
        <p className="muted">Loading courses…</p>
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
                    <Link to={`/app/course/${course.id}`} className="btn btn-primary btn-sm">
                      Continue
                    </Link>
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
