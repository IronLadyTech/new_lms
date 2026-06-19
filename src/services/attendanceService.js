import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getDateKey,
  getTodayKey,
  isWeekendKey,
  formatDisplayDate,
} from '../utils/streakTimezone';

const ATTENDANCE = 'attendance';

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  WEEK_OFF: 'week_off',
};

export const DEFAULT_ATTENDANCE_THRESHOLD = 0.6;

function attendanceDocId(learnerId, courseId, dateKey) {
  return `${learnerId}_${courseId}_${dateKey}`;
}

export async function setAttendanceRecord(learnerId, courseId, dateKey, status) {
  if (!db || !learnerId || !courseId || !dateKey) return;
  const ref = doc(db, ATTENDANCE, attendanceDocId(learnerId, courseId, dateKey));
  await setDoc(
    ref,
    {
      learnerId,
      courseId,
      date: dateKey,
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Auto-mark present when a qualifying submission lands (same calendar day). */
export async function markPresentFromSubmission(learnerId, courseId) {
  if (!db || !learnerId || !courseId) return;
  const today = getTodayKey();
  if (isWeekendKey(today)) return;
  return setAttendanceRecord(learnerId, courseId, today, ATTENDANCE_STATUS.PRESENT);
}

function attendanceQuery(learnerId, courseId) {
  return query(
    collection(db, ATTENDANCE),
    where('learnerId', '==', learnerId),
    where('courseId', '==', courseId)
  );
}

function mapAttendanceSnapshot(snap, startKey, endKey) {
  const days = snap.docs
    .map((d) => d.data())
    .filter((data) => data.date && data.date >= startKey && data.date <= endKey)
    .map((data) => ({ date: data.date, status: data.status }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

function attendanceErrorMessage(err) {
  const code = err?.code || '';
  if (code === 'permission-denied') {
    return 'Attendance is not available yet. Ask your admin to deploy the latest Firestore rules.';
  }
  if (code === 'failed-precondition') {
    return 'Attendance index is building. Try again in a few minutes or contact your admin.';
  }
  return 'Could not load attendance. Check your connection or try again.';
}

/** Returns only attendance rows stored in Firestore — no synthetic absent/week-off fill. */
export async function getAttendanceRecords(learnerId, courseId, startKey, endKey) {
  if (!db || !learnerId || !courseId) return { courseId, days: [] };
  if (courseId === 'general') return { courseId, days: [] };

  try {
    const snap = await getDocs(attendanceQuery(learnerId, courseId));
    return { courseId, days: mapAttendanceSnapshot(snap, startKey, endKey) };
  } catch (err) {
    console.warn('attendance read failed', err);
    throw Object.assign(err, { userMessage: attendanceErrorMessage(err) });
  }
}

/**
 * Real-time attendance listener for the selected course and date range.
 * @returns {() => void} unsubscribe
 */
export function subscribeAttendanceRecords(learnerId, courseId, startKey, endKey, onData, onError) {
  if (!db || !learnerId || !courseId) {
    onData([]);
    return () => {};
  }
  if (courseId === 'general') {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    attendanceQuery(learnerId, courseId),
    (snap) => onData(mapAttendanceSnapshot(snap, startKey, endKey)),
    (err) => {
      console.warn('Attendance listener failed', err);
      onError?.(Object.assign(err, { userMessage: attendanceErrorMessage(err) }));
    }
  );
}

/**
 * @param {{ date: string, status: string|null }[]} days
 * @param {number} threshold
 */
export function computeAttendanceAnalytics(days, threshold = DEFAULT_ATTENDANCE_THRESHOLD) {
  const scheduled = days.filter(
    (d) => d.status && d.status !== ATTENDANCE_STATUS.WEEK_OFF
  );
  const present = scheduled.filter((d) => d.status === ATTENDANCE_STATUS.PRESENT);
  const absent = scheduled.filter((d) => d.status === ATTENDANCE_STATUS.ABSENT);
  const weekOff = days.filter((d) => d.status === ATTENDANCE_STATUS.WEEK_OFF);

  const attendancePct =
    scheduled.length > 0 ? Math.round((present.length / scheduled.length) * 100) : null;

  let longestAbsentStreak = 0;
  let run = 0;
  scheduled.forEach((d) => {
    if (d.status === ATTENDANCE_STATUS.ABSENT) {
      run += 1;
      longestAbsentStreak = Math.max(longestAbsentStreak, run);
    } else {
      run = 0;
    }
  });

  const byMonth = {};
  days.forEach((d) => {
    if (!d.status || d.status === ATTENDANCE_STATUS.WEEK_OFF) return;
    const month = d.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { present: 0, absent: 0, total: 0 };
    byMonth[month].total += 1;
    if (d.status === ATTENDANCE_STATUS.PRESENT) byMonth[month].present += 1;
    else if (d.status === ATTENDANCE_STATUS.ABSENT) byMonth[month].absent += 1;
  });

  const flaggedMonths = Object.entries(byMonth)
    .filter(([, v]) => v.total > 0 && v.present / v.total < threshold)
    .map(([month, v]) => ({
      month,
      pct: Math.round((v.present / v.total) * 100),
    }));

  const insights = [];
  if (attendancePct != null && flaggedMonths.length > 0) {
    const worst = flaggedMonths.sort((a, b) => a.pct - b.pct)[0];
    const [y, m] = worst.month.split('-');
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    insights.push(`${monthName} attendance dropped to ~${worst.pct}% — investigate.`);
  }
  if (longestAbsentStreak >= 5) {
    insights.push(`Longest absent run: ${longestAbsentStreak} scheduled days in this range.`);
  }
  if (attendancePct != null && attendancePct >= 80) {
    insights.push(`Strong attendance at ${attendancePct}% present in the selected range.`);
  }

  return {
    presentCount: present.length,
    absentCount: absent.length,
    weekOffCount: weekOff.length,
    scheduledCount: scheduled.length,
    attendancePct,
    longestAbsentStreak,
    byMonth,
    flaggedMonths,
    insights,
  };
}

export function buildAttendanceGridMonths(days) {
  const months = {};
  days.forEach(({ date, status }) => {
    const [y, m, dayNum] = date.split('-');
    const key = `${y}-${m}`;
    if (!months[key]) {
      months[key] = {
        label: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        }),
        year: Number(y),
        month: Number(m),
        cells: {},
      };
    }
    months[key].cells[Number(dayNum)] = status;
  });
  return Object.values(months).sort((a, b) => a.year - b.year || a.month - b.month);
}

export function attendanceStatusLabel(status) {
  if (status === ATTENDANCE_STATUS.PRESENT) return 'Present';
  if (status === ATTENDANCE_STATUS.ABSENT) return 'Absent';
  if (status === ATTENDANCE_STATUS.WEEK_OFF) return 'Week-off';
  return 'No data';
}

export function attendanceTooltip(date, status) {
  return `${formatDisplayDate(date)} — ${attendanceStatusLabel(status)}`;
}

/**
 * Fetch attendance summary for all members of a batch across given courseIds.
 * Returns { [learnerId]: { present, total } }
 */
export async function getBatchAttendanceSummary(memberIds, courseIds, startKey, endKey) {
  if (!courseIds?.length || !memberIds?.length) return {};
  const memberSet = new Set(memberIds);
  const limited = courseIds.slice(0, 10); // Firestore 'in' supports max 10
  try {
    const snap = await getDocs(
      query(collection(db, ATTENDANCE), where('courseId', 'in', limited))
    );
    const summary = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!memberSet.has(data.learnerId)) return;
      if (data.date < startKey || data.date > endKey) return;
      if (!summary[data.learnerId]) summary[data.learnerId] = { present: 0, total: 0 };
      if (data.status !== ATTENDANCE_STATUS.WEEK_OFF) {
        summary[data.learnerId].total += 1;
        if (data.status === ATTENDANCE_STATUS.PRESENT) summary[data.learnerId].present += 1;
      }
    });
    return summary;
  } catch (err) {
    console.warn('getBatchAttendanceSummary failed', err);
    return {};
  }
}
