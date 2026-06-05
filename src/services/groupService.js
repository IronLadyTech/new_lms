import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const GROUPS = 'groups';

export async function getGroups() {
  const snap = await getDocs(collection(db, GROUPS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createGroup({ name, description, courseIds = [], memberIds = [], createdBy }) {
  const ref = doc(collection(db, GROUPS));
  const group = {
    name,
    description: description || '',
    courseIds,
    memberIds,
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, group);
  return { id: ref.id, ...group };
}

export async function updateGroup(groupId, data) {
  await updateDoc(doc(db, GROUPS, groupId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteGroup(groupId) {
  await deleteDoc(doc(db, GROUPS, groupId));
}

export async function addMemberToGroup(groupId, userId) {
  await updateDoc(doc(db, GROUPS, groupId), {
    memberIds: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function addCourseToGroup(groupId, courseId) {
  await updateDoc(doc(db, GROUPS, groupId), {
    courseIds: arrayUnion(courseId),
    updatedAt: serverTimestamp(),
  });
}
