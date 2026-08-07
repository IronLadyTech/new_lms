import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  documentId,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ROLES } from '../utils/roles';
import { isSuperAdminEmail } from '../utils/constants';
import { recordSubmissionEvent } from './submissionEventService';
import { PROGRAMS } from '../data/programTypes';
import { mergeInQuery } from '../utils/firestoreChunks';

const USERS = 'users';
const ACTIVITIES = 'activities';

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayKey() {
  return getLocalDateKey(new Date());
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

function toDateKey(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return getLocalDateKey(d);
}

function collectActiveDates(profile, activities) {
  const dates = new Set();
  const profileDate = toDateKey(profile?.lastActivityAt);
  if (profileDate) dates.add(profileDate);
  (activities || []).forEach((a) => {
    const key = toDateKey(a.createdAt);
    if (key) dates.add(key);
  });
  return dates;
}

function countConsecutiveStreak(activeDates) {
  if (!activeDates.size) return 0;

  const today = getTodayKey();
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  if (!activeDates.has(getLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activeDates.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Updates streak when the user is active on a new calendar day. */
function computeStreakUpdate(profile) {
  const today = getTodayKey();
  const lastStreakDate = profile?.lastStreakDate || null;
  const currentStreak = profile?.streak || 0;

  if (lastStreakDate === today) return {};

  const yesterday = getYesterdayKey();
  let newStreak = 1;
  if (lastStreakDate === yesterday) {
    newStreak = currentStreak + 1;
  }

  return { streak: newStreak, lastStreakDate: today };
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function resolveRoleForEmail(email, fallback = ROLES.STUDENT) {
  return isSuperAdminEmail(email) ? ROLES.SUPERADMIN : fallback;
}

/** Ensures the owner email always has superadmin role (e.g. after Google sign-in). */
export async function ensureSuperAdminIfOwner(uid, email) {
  if (!isSuperAdminEmail(email)) return null;
  const existing = await getUserProfile(uid);
  if (existing?.role === ROLES.SUPERADMIN && existing?.blocked !== true) return existing;
  await updateDoc(doc(db, USERS, uid), {
    role: ROLES.SUPERADMIN,
    blocked: false,
    updatedAt: serverTimestamp(),
  });
  return getUserProfile(uid);
}

export async function createUserProfile(uid, { email, displayName, role = ROLES.STUDENT }) {
  const resolvedRole = resolveRoleForEmail(email, role);
  const profile = {
    email,
    displayName: displayName || email?.split('@')[0] || 'User',
    role: resolvedRole,
    blocked: false,
    enrolledCourses: [],
    streak: 0,
    lastStreakDate: null,
    lastActivityAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, USERS, uid), profile);

  return profile;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, USERS, uid), { ...data, updatedAt: serverTimestamp() });
}

/** Link a learner to a batch (Customer Expression / program cohort). */
export async function assignUserToBatch(uid, { batchId, batchName, program }) {
  await updateDoc(doc(db, USERS, uid), {
    batchId: batchId || null,
    batchName: batchName || null,
    program: program || null,
    updatedAt: serverTimestamp(),
  });
}

export async function clearUserBatch(uid) {
  await updateDoc(doc(db, USERS, uid), {
    batchId: null,
    batchName: null,
    program: null,
    updatedAt: serverTimestamp(),
  });
}

export async function enrollInCourse(uid, courseId, courseTitle) {
  await updateDoc(doc(db, USERS, uid), {
    enrolledCourses: arrayUnion(courseId),
    updatedAt: serverTimestamp(),
  });

  await logUserActivity(uid, {
    type: 'course_enroll',
    courseId,
    title: courseTitle || null,
  }).catch(() => {});
}

export async function logUserActivity(uid, { type, courseId, title, metadata }) {
  await setDoc(doc(collection(db, ACTIVITIES)), {
    userId: uid,
    type,
    courseId: courseId || null,
    title: title || type,
    metadata: metadata || {},
    createdAt: serverTimestamp(),
  });

  const profile = await getUserProfile(uid);
  const streakUpdate = computeStreakUpdate(profile);

  await updateDoc(doc(db, USERS, uid), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...streakUpdate,
  });

  if (type === 'mock_test' || metadata?.resourceType === 'mock_test') {
    recordSubmissionEvent({
      learnerId: uid,
      courseId: courseId || 'general',
      problemId: metadata?.problemId || title || null,
      isCorrect: metadata?.isCorrect !== false,
    }).catch(() => {});
  } else if (type === 'assignment_submit' || metadata?.resourceType === 'assignment') {
    recordSubmissionEvent({
      learnerId: uid,
      courseId: courseId || 'general',
      problemId: metadata?.assignmentId || metadata?.resourceId || title || null,
      isCorrect: metadata?.isCorrect !== false,
    }).catch(() => {});
  } else if (type === 'resource_view' && courseId) {
    recordSubmissionEvent({
      learnerId: uid,
      courseId,
      problemId: metadata?.resourceId || title || metadata?.resourceType || null,
      isCorrect: true,
    }).catch(() => {});
  }
}

export async function getUserActivities(uid, limitCount = 20) {
  try {
    const q = query(
      collection(db, ACTIVITIES),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const message = String(e?.message || '');
    if (!message.includes('index')) throw e;

    const snap = await getDocs(query(collection(db, ACTIVITIES), where('userId', '==', uid)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return items.slice(0, limitCount);
  }
}

export async function getAllUsers(limitCount = 500) {
  try {
    const snap = await getDocs(
      query(collection(db, USERS), orderBy('createdAt', 'desc'), limit(limitCount))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const message = String(e?.message || '');
    if (!message.includes('index')) throw e;

    const snap = await getDocs(collection(db, USERS));
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    users.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return users.slice(0, limitCount);
  }
}

/** Fetch specific user docs by id (chunked `in` queries). */
export async function getUsersByIds(ids = []) {
  if (!db || !ids.length) return [];
  const map = await mergeInQuery(ids, async (chunk) => {
    const snap = await getDocs(query(collection(db, USERS), where(documentId(), 'in', chunk)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return [...map.values()];
}

/**
 * CX-scoped learner load — avoids reading the entire users collection.
 * Pulls by program, by batchId, and by batch memberIds (chunked `in` queries).
 */
export async function getUsersForCxProgram(program, batches = []) {
  if (!db) return [];

  const byId = new Map();
  const addSnap = (snap) => {
    snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  };

  const programKey = program || PROGRAMS.MBW;
  const batchIds = (batches || []).map((b) => b.id).filter(Boolean);
  const memberIds = [...new Set((batches || []).flatMap((b) => b.memberIds || []))];

  const firstPass = [
    getDocs(query(collection(db, USERS), where('program', '==', programKey)))
      .then(addSnap)
      .catch((err) => console.warn('CX users by program failed', err?.code || err)),
  ];

  if (batchIds.length) {
    firstPass.push(
      mergeInQuery(batchIds, async (chunk) => {
        const snap = await getDocs(query(collection(db, USERS), where('batchId', 'in', chunk)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      })
        .then((map) => map.forEach((u, id) => byId.set(id, u)))
        .catch((err) => console.warn('CX users by batchId failed', err?.code || err))
    );
  }

  await Promise.all(firstPass);

  const missingMemberIds = memberIds.filter((id) => !byId.has(id));
  if (missingMemberIds.length) {
    try {
      const map = await mergeInQuery(missingMemberIds, async (chunk) => {
        const snap = await getDocs(
          query(collection(db, USERS), where(documentId(), 'in', chunk))
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      });
      map.forEach((u, id) => byId.set(id, u));
    } catch (err) {
      console.warn('CX users by memberId failed', err?.code || err);
    }
  }

  const users = [...byId.values()];
  users.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return users;
}

export async function getAllActivities(limitCount = 100) {
  try {
    const snap = await getDocs(
      query(collection(db, ACTIVITIES), orderBy('createdAt', 'desc'), limit(limitCount))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const message = String(e?.message || '');
    if (!message.includes('index')) throw e;

    const snap = await getDocs(collection(db, ACTIVITIES));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return items.slice(0, limitCount);
  }
}

export async function assignAdminRole(uid, role) {
  await updateDoc(doc(db, USERS, uid), { role, updatedAt: serverTimestamp() });
}

/** Sets the program a CX member (moderator) is scoped to: mbw | lep | 100bm. */
export async function setUserProgram(uid, program) {
  await updateDoc(doc(db, USERS, uid), { program, updatedAt: serverTimestamp() });
}

export async function setUserBlocked(uid, blocked) {
  await updateDoc(doc(db, USERS, uid), { blocked, updatedAt: serverTimestamp() });
}

export async function incrementStreak(uid) {
  const profile = await getUserProfile(uid);
  const streakUpdate = computeStreakUpdate(profile);
  if (Object.keys(streakUpdate).length === 0) return profile?.streak || 0;

  await updateDoc(doc(db, USERS, uid), {
    ...streakUpdate,
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return streakUpdate.streak;
}

/** Recalculate streak from profile + recent activity log. */
export async function saveFcmToken(uid, token) {
  if (!uid || !token) return;
  await updateDoc(doc(db, USERS, uid), { fcmToken: token, updatedAt: serverTimestamp() });
}

export async function syncUserStreak(uid) {
  const profile = await getUserProfile(uid);
  if (!profile) return 0;

  const today = getTodayKey();
  if (profile.lastStreakDate === today && (profile.streak || 0) > 0) {
    return profile.streak;
  }

  const activities = await getUserActivities(uid, 90);
  const activeDates = collectActiveDates(profile, activities);
  const streak = countConsecutiveStreak(activeDates);

  if (streak === 0) return profile.streak || 0;

  const lastStreakDate = activeDates.has(today) ? today : getYesterdayKey();

  await updateDoc(doc(db, USERS, uid), {
    streak,
    lastStreakDate,
    updatedAt: serverTimestamp(),
  });

  return streak;
}
