import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCourses } from '../services/courseService';
import { normalizeCourseCode } from '../utils/programTaskRoutes';

export default function useBm100Enrollment() {
  const { profile, isGuest } = useAuth();
  const [enrolled, setEnrolled] = useState(null);

  useEffect(() => {
    if (isGuest) {
      setEnrolled(false);
      return undefined;
    }
    if (!profile?.enrolledCourses?.length) {
      setEnrolled(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const list = await getCourses();
        const bm100 = list.find((c) => normalizeCourseCode(c.code) === '100BM');
        if (!cancelled) {
          setEnrolled(!!bm100 && profile.enrolledCourses.includes(bm100.id));
        }
      } catch {
        if (!cancelled) setEnrolled(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, isGuest]);

  return { enrolled, isEnrolled: enrolled === true };
}
