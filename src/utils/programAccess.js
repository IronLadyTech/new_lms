/**
 * Iron Lady program journey display order: LEP → 100BM → MBW.
 * Access is strict enrollment — each program opens only when the learner is
 * enrolled in that program (no cascade from MBW → 100BM / LEP).
 */
import { PROGRAMS } from '../data/programTypes';
import { normalizeCourseCode } from './programTaskRoutes';

export const PROGRAM_JOURNEY = [
  {
    id: PROGRAMS.LEP,
    code: 'LEP',
    shortLabel: 'LEP',
    title: 'Leadership Essentials Program',
    order: 0,
    tasksPath: null,
  },
  {
    id: PROGRAMS.BM100,
    code: '100BM',
    shortLabel: '100BM',
    title: '100 Board Members',
    order: 1,
    tasksPath: '/app/100bm',
  },
  {
    id: PROGRAMS.MBW,
    code: 'MBW',
    shortLabel: 'MBW',
    title: 'Master of Business Warfare',
    order: 2,
    tasksPath: '/app/mbw',
  },
];

export const PROGRAM_ACCESS = {
  OPEN: 'open',
  UPCOMING: 'upcoming',
  LOCKED: 'locked',
};

export function courseCodeToProgramId(code) {
  const normalized = normalizeCourseCode(code);
  if (normalized === 'LEP') return PROGRAMS.LEP;
  if (normalized === '100BM') return PROGRAMS.BM100;
  if (normalized === 'MBW') return PROGRAMS.MBW;
  return null;
}

export function programIdToCode(programId) {
  return PROGRAM_JOURNEY.find((p) => p.id === programId)?.code || null;
}

export function getJourneyEntry(programIdOrCode) {
  const asId = String(programIdOrCode || '').toLowerCase();
  const asCode = normalizeCourseCode(programIdOrCode);
  return (
    PROGRAM_JOURNEY.find((p) => p.id === asId || p.code === asCode) || null
  );
}

/**
 * Programs the learner is explicitly enrolled in.
 * Sources: enrolledCourses (+ course list), profile.program, profile.programs[].
 */
export function getEnrolledProgramIds(profile, courses = []) {
  const ids = new Set();
  if (!profile) return ids;

  const courseById = new Map((courses || []).map((c) => [c.id, c]));
  (profile.enrolledCourses || []).forEach((courseId) => {
    const course = courseById.get(courseId);
    const programId = courseCodeToProgramId(course?.code);
    if (programId) ids.add(programId);
  });

  const primary = getJourneyEntry(profile.program);
  if (primary) ids.add(primary.id);

  (profile.programs || []).forEach((value) => {
    const entry = getJourneyEntry(value);
    if (entry) ids.add(entry.id);
  });

  return ids;
}

/** Course records the learner is enrolled in (all enrollment sources). */
export function getEnrolledCourses(profile, courses = []) {
  if (!profile) return [];

  const courseList = courses || [];
  const courseById = new Map(courseList.map((c) => [c.id, c]));
  const enrolledProgramIds = getEnrolledProgramIds(profile, courseList);
  const byKey = new Map();

  courseList.forEach((course) => {
    const programId = courseCodeToProgramId(course.code);
    if (programId && enrolledProgramIds.has(programId)) {
      byKey.set(programId, course);
    }
  });

  (profile.enrolledCourses || []).forEach((courseId) => {
    const course = courseById.get(courseId);
    if (!course) return;

    const programId = courseCodeToProgramId(course.code);
    if (programId) {
      if (!byKey.has(programId)) byKey.set(programId, course);
      return;
    }

    if (![...byKey.values()].some((entry) => entry.id === course.id)) {
      byKey.set(`course-${course.id}`, course);
    }
  });

  enrolledProgramIds.forEach((programId) => {
    if (byKey.has(programId)) return;

    const entry = PROGRAM_JOURNEY.find((p) => p.id === programId);
    if (!entry) return;

    byKey.set(programId, {
      id: `program-${programId}`,
      code: entry.code,
      title: entry.title,
      description: '',
      synthetic: true,
    });
  });

  return [...byKey.values()].sort((a, b) => {
    const aOrder = getJourneyEntry(a.code)?.order ?? 99;
    const bOrder = getJourneyEntry(b.code)?.order ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function isSyntheticCourse(course) {
  return Boolean(course?.synthetic) || String(course?.id || '').startsWith('program-');
}

/** Firestore course IDs for resources/activity — resolves program enrollment to course docs. */
export function resolveEnrolledFirestoreCourseIds(profile, courses = []) {
  const ids = new Set();
  const courseList = courses || [];

  getEnrolledCourses(profile, courseList).forEach((course) => {
    if (!isSyntheticCourse(course)) {
      ids.add(course.id);
      return;
    }
    const programId = courseCodeToProgramId(course.code);
    const match = courseList.find((c) => courseCodeToProgramId(c.code) === programId);
    if (match?.id) ids.add(match.id);
  });

  (profile?.enrolledCourses || []).forEach((courseId) => {
    if (courseList.some((c) => c.id === courseId)) ids.add(courseId);
  });

  return [...ids];
}

export function getHighestEnrolledOrder(enrolledIds) {
  let highest = -1;
  PROGRAM_JOURNEY.forEach((p) => {
    if (enrolledIds.has(p.id)) highest = Math.max(highest, p.order);
  });
  return highest;
}

/** Open only when the learner is enrolled in that exact program. */
export function canAccessProgram(programIdOrCode, profile, courses = []) {
  const entry = getJourneyEntry(programIdOrCode);
  if (!entry || !profile) return false;
  return getEnrolledProgramIds(profile, courses).has(entry.id);
}

export function getProgramAccessState(programIdOrCode, profile, courses = []) {
  const entry = getJourneyEntry(programIdOrCode);
  if (!entry) {
    return {
      state: PROGRAM_ACCESS.LOCKED,
      canAccess: false,
      enrolled: false,
      label: 'Locked',
      message: 'This program is not available yet.',
      cta: 'Speak to our Counsellor',
    };
  }

  const enrolledIds = getEnrolledProgramIds(profile, courses);
  const enrolled = enrolledIds.has(entry.id);
  const highest = getHighestEnrolledOrder(enrolledIds);

  if (enrolled) {
    return {
      state: PROGRAM_ACCESS.OPEN,
      canAccess: true,
      enrolled: true,
      label: 'Enrolled',
      message: 'You are enrolled in this program.',
      cta: entry.tasksPath ? 'Open tasks' : 'Continue',
    };
  }

  const nextOrder = highest < 0 ? 0 : highest + 1;
  if (entry.order === nextOrder) {
    return {
      state: PROGRAM_ACCESS.UPCOMING,
      canAccess: false,
      enrolled: false,
      label: 'Upcoming',
      message: `Next in your Iron Lady journey after ${
        highest < 0 ? 'getting started' : PROGRAM_JOURNEY[highest].shortLabel
      }. Speak to our Counsellor when you are ready.`,
      cta: 'Speak to our Counsellor',
    };
  }

  return {
    state: PROGRAM_ACCESS.LOCKED,
    canAccess: false,
    enrolled: false,
    label: 'Locked',
    message:
      'You are not enrolled in this program. Ask Iron Lady to unlock it when you are eligible.',
    cta: 'Speak to our Counsellor',
  };
}

export function sortCoursesByJourney(courses = []) {
  return [...courses].sort((a, b) => {
    const aEntry = getJourneyEntry(a.code);
    const bEntry = getJourneyEntry(b.code);
    const aOrder = aEntry?.order ?? 99;
    const bOrder = bEntry?.order ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/** Enrolled programs first, then journey order (LEP → 100BM → MBW). */
export function sortCoursesForDashboard(courses = [], profile = null) {
  const enrolledIds = getEnrolledProgramIds(profile, courses);
  return [...courses].sort((a, b) => {
    const aId = courseCodeToProgramId(a.code);
    const bId = courseCodeToProgramId(b.code);
    const aEnrolled = aId ? enrolledIds.has(aId) : false;
    const bEnrolled = bId ? enrolledIds.has(bId) : false;
    if (aEnrolled !== bEnrolled) return aEnrolled ? -1 : 1;

    const aOrder = getJourneyEntry(a.code)?.order ?? 99;
    const bOrder = getJourneyEntry(b.code)?.order ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function getContinueProgram(profile, courses = []) {
  const enrolledIds = getEnrolledProgramIds(profile, courses);
  const highest = getHighestEnrolledOrder(enrolledIds);
  if (highest < 0) return null;
  const entry = PROGRAM_JOURNEY[highest];
  return (courses || []).find((c) => courseCodeToProgramId(c.code) === entry.id) || null;
}
