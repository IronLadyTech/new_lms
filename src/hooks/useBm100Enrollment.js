import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCourses } from '../services/courseService';
import { canAccessProgram } from '../utils/programAccess';
import { PROGRAMS } from '../data/programTypes';

/** True when the learner is enrolled in 100BM specifically. */
export default function useBm100Enrollment() {
  const { profile, isGuest } = useAuth();
  const [enrolled, setEnrolled] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    if (isGuest) {
      setEnrolled(false);
      setCourses([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const list = await getCourses();
        if (cancelled) return;
        setCourses(list);
        setEnrolled(canAccessProgram(PROGRAMS.BM100, profile, list));
      } catch {
        if (!cancelled) setEnrolled(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, isGuest]);

  return { enrolled, isEnrolled: enrolled === true, courses };
}
