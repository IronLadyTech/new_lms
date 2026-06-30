import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PROGRAMS } from '../data/programTypes';
import { assignUserToBatch, clearUserBatch } from './userService';

const GROUPS = 'groups';

export async function getGroups() {
  const snap = await getDocs(collection(db, GROUPS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, GROUPS, groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createGroup({
  name,
  description,
  courseIds = [],
  memberIds = [],
  moderatorIds = [],
  program = PROGRAMS.MBW,
  createdBy,
}) {
  const ref = doc(collection(db, GROUPS));
  const group = {
    name,
    description: description || '',
    program: program || PROGRAMS.MBW,
    courseIds,
    memberIds,
    moderatorIds: moderatorIds || [],
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

export async function setBatchModerators(groupId, moderatorIds) {
  await updateDoc(doc(db, GROUPS, groupId), {
    moderatorIds: moderatorIds || [],
    updatedAt: serverTimestamp(),
  });
}

export async function addMemberToGroup(groupId, userId) {
  const group = await getGroup(groupId);
  if (!group) throw new Error('Batch not found');

  const userSnap = await getDoc(doc(db, 'users', userId));
  const oldBatchId = userSnap.exists() ? userSnap.data().batchId : null;
  if (oldBatchId && oldBatchId !== groupId) {
    await updateDoc(doc(db, GROUPS, oldBatchId), {
      memberIds: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(doc(db, GROUPS, groupId), {
    memberIds: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });

  await assignUserToBatch(userId, {
    batchId: groupId,
    batchName: group.name,
    program: group.program || PROGRAMS.MBW,
  });
}

/** Remove from current batch and add to another (shift learner between cohorts). */
export async function moveMemberToGroup(userId, toGroupId) {
  return addMemberToGroup(toGroupId, userId);
}

export async function removeMemberFromGroup(groupId, userId) {
  await updateDoc(doc(db, GROUPS, groupId), {
    memberIds: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });

  const userBatch = await getDoc(doc(db, 'users', userId));
  if (userBatch.exists() && userBatch.data().batchId === groupId) {
    await clearUserBatch(userId);
  }
}

export async function addCourseToGroup(groupId, courseId) {
  await updateDoc(doc(db, GROUPS, groupId), {
    courseIds: arrayUnion(courseId),
    updatedAt: serverTimestamp(),
  });
}
