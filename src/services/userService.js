import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ROLES } from '../utils/roles';
import { isSuperAdminEmail } from '../utils/constants';

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
}

export async function getUserActivities(uid, limitCount = 20) {
  const q = query(collection(db, ACTIVITIES), where('userId', '==', uid));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return items.slice(0, limitCount);
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, USERS));
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  users.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return users;
}

export async function getAllActivities(limitCount = 100) {
  const snap = await getDocs(collection(db, ACTIVITIES));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return items.slice(0, limitCount);
}

export async function assignAdminRole(uid, role) {
  await updateDoc(doc(db, USERS, uid), { role, updatedAt: serverTimestamp() });
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
