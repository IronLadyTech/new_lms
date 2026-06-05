import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COURSES = 'courses';
const RESOURCES = 'resources';
const ASSIGNMENTS = 'assignments';

export const COURSE_CODES = {
  MBW: 'MBW',
  LEP: 'LEP',
};

export async function getCourses() {
  const snap = await getDocs(collection(db, COURSES));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCourse(courseId) {
  const snap = await getDoc(doc(db, COURSES, courseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createCourse(data) {
  const ref = doc(collection(db, COURSES));
  const course = {
    title: data.title,
    code: data.code,
    description: data.description || '',
    thumbnail: data.thumbnail || '',
    introUrl: data.introUrl || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, course);
  return { id: ref.id, ...course };
}

export async function updateCourse(courseId, data) {
  await updateDoc(doc(db, COURSES, courseId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteCourse(courseId) {
  await deleteDoc(doc(db, COURSES, courseId));
}

export async function getResources(courseId) {
  const q = courseId
    ? query(collection(db, RESOURCES), where('courseId', '==', courseId))
    : collection(db, RESOURCES);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createResource(data) {
  const ref = doc(collection(db, RESOURCES));
  const resource = {
    courseId: data.courseId,
    title: data.title,
    type: data.type,
    url: data.url,
    description: data.description || '',
    locked: data.locked ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, resource);
  return { id: ref.id, ...resource };
}

export async function updateResource(resourceId, data) {
  await updateDoc(doc(db, RESOURCES, resourceId), { ...data, updatedAt: serverTimestamp() });
}

export async function setResourceLocked(resourceId, locked) {
  await updateResource(resourceId, { locked });
}

export async function deleteResource(resourceId) {
  await deleteDoc(doc(db, RESOURCES, resourceId));
}

export async function getAssignments(courseId) {
  const q = courseId
    ? query(collection(db, ASSIGNMENTS), where('courseId', '==', courseId))
    : collection(db, ASSIGNMENTS);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAssignment(data) {
  const ref = doc(collection(db, ASSIGNMENTS));
  const assignment = {
    courseId: data.courseId,
    title: data.title,
    dueDate: data.dueDate || null,
    description: data.description || '',
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, assignment);
  return { id: ref.id, ...assignment };
}

export async function seedDefaultCourses() {
  const existing = await getCourses();
  if (existing.length > 0) return existing;

  const defaults = [
    {
      title: 'MBW Program',
      code: COURSE_CODES.MBW,
      description: 'Mastering Business Workflows — core IL LMS track.',
    },
    {
      title: 'LEP Program',
      code: COURSE_CODES.LEP,
      description: 'Leadership Excellence Program — advanced learning path.',
    },
  ];

  const created = [];
  for (const c of defaults) {
    created.push(await createCourse(c));
  }
  return created;
}
