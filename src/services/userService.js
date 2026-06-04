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
import { syncUserToZoho } from './zohoService';

const USERS = 'users';
const ACTIVITIES = 'activities';

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createUserProfile(uid, { email, displayName, role = ROLES.STUDENT }) {
  const profile = {
    email,
    displayName: displayName || email?.split('@')[0] || 'User',
    role,
    enrolledCourses: [],
    streak: 0,
    lastActivityAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, USERS, uid), profile);

  syncUserToZoho({
    email,
    displayName: profile.displayName,
    uid,
    enrolledCourses: [],
  }).catch(() => {});

  return profile;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, USERS, uid), { ...data, updatedAt: serverTimestamp() });
}

export async function enrollInCourse(uid, courseId) {
  await updateDoc(doc(db, USERS, uid), {
    enrolledCourses: arrayUnion(courseId),
    updatedAt: serverTimestamp(),
  });

  const profile = await getUserProfile(uid);
  if (profile) {
    syncUserToZoho({
      email: profile.email,
      displayName: profile.displayName,
      uid,
      enrolledCourses: [...(profile.enrolledCourses || []), courseId],
    }).catch(() => {});
  }
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

  await updateDoc(doc(db, USERS, uid), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function assignAdminRole(uid, role) {
  await updateDoc(doc(db, USERS, uid), { role, updatedAt: serverTimestamp() });
}

export async function incrementStreak(uid) {
  const profile = await getUserProfile(uid);
  const streak = (profile?.streak || 0) + 1;
  await updateDoc(doc(db, USERS, uid), { streak, updatedAt: serverTimestamp() });
  return streak;
}
