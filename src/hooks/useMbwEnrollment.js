import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCourses } from '../services/courseService';

export default function useMbwEnrollment() {
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
        const mbw = list.find((c) => c.code === 'MBW');
        if (!cancelled) {
          setEnrolled(!!mbw && profile.enrolledCourses.includes(mbw.id));
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
