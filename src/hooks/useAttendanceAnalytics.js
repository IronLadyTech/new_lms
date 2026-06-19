import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAttendanceRecords,
  subscribeAttendanceRecords,
  computeAttendanceAnalytics,
  buildAttendanceGridMonths,
  DEFAULT_ATTENDANCE_THRESHOLD,
} from '../services/attendanceService';
import { addDaysToKey, getTodayKey } from '../utils/streakTimezone';

function defaultRange() {
  const end = getTodayKey();
  const start = addDaysToKey(end, -179);
  return { start, end };
}

export function useAttendanceAnalytics(learnerId, courseId) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(defaultRange);

  const load = useCallback(async () => {
    if (!learnerId || !courseId) {
      setDays([]);
      setLoading(false);
      return;
    }
    try {
      const result = await getAttendanceRecords(learnerId, courseId, range.start, range.end);
      setDays(result.days);
      setError(null);
    } catch (err) {
      console.warn('Attendance load failed', err);
      setError(err?.userMessage || 'Could not load attendance. Check your connection or try again.');
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [learnerId, courseId, range.start, range.end]);

  useEffect(() => {
    if (!learnerId || !courseId) {
      setDays([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const unsub = subscribeAttendanceRecords(
      learnerId,
      courseId,
      range.start,
      range.end,
      (records) => {
        if (cancelled) return;
        setDays(records);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.warn('Attendance listener failed — falling back to fetch', err);
        setError(err?.userMessage || null);
        load();
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [learnerId, courseId, range.start, range.end, load]);

  const analytics = useMemo(
    () => computeAttendanceAnalytics(days, DEFAULT_ATTENDANCE_THRESHOLD),
    [days]
  );

  const gridMonths = useMemo(() => buildAttendanceGridMonths(days), [days]);

  return {
    days,
    analytics,
    gridMonths,
    loading,
    error,
    range,
    setRange,
    retry: load,
  };
}
