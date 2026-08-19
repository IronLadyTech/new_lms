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
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PROGRAMS } from '../data/programTypes';
import { assignUserToBatch, clearUserBatch } from './userService';

const GROUPS = 'groups';

export async function getGroups() {
  const snap = await getDocs(collection(db, GROUPS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Prefer this for CX — fewer reads when many non-program batches exist. */
export async function getGroupsByProgram(program = PROGRAMS.MBW) {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, GROUPS), where('program', '==', program)));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Legacy MBW batches may omit program — include them only for MBW.
    if (program === PROGRAMS.MBW) {
      const all = await getGroups();
      const byId = new Map(rows.map((g) => [g.id, g]));
      all.forEach((g) => {
        if (!g.program || g.program === PROGRAMS.MBW) byId.set(g.id, g);
      });
      return [...byId.values()];
    }
    return rows;
  } catch (err) {
    console.warn('getGroupsByProgram failed, falling back to getGroups', err?.code || err);
    return (await getGroups()).filter((g) => (g.program || PROGRAMS.MBW) === program);
  }
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

/* ── Session recordings ─────────────────────────────────────────────────────
 * Held in a `recordings` subcollection, not on the batch document.
 *
 * They were an array on the group doc, and batch members can read that doc, so
 * a learner who had paid only the registration fee could read the links to
 * every paid session in their cohort. Firestore cannot withhold one field from
 * a readable document, so the links had to move somewhere learners cannot read.
 *
 * Staff read and write here; learners never do. getLessonAsset serves a URL
 * server-side once it has checked the learner paid for that programme.
 * ────────────────────────────────────────────────────────────────────────── */

const RECORDINGS = 'recordings';

function recordingsRef(groupId) {
  return collection(db, GROUPS, groupId, RECORDINGS);
}

/** Every recording on a batch. Staff only — rules enforce it. */
export async function getBatchRecordings(groupId) {
  if (!db || !groupId) return [];
  const snap = await getDocs(recordingsRef(groupId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * One recording per session. Saving the same session again replaces the link
 * rather than leaving two, which is what CX means by re-uploading a session.
 */
export async function saveBatchRecording(groupId, recording) {
  if (!db) throw new Error('Firebase is not configured');
  const sessionId = recording.sessionId || '';
  // Keyed on the session so a re-upload overwrites in place; recordings with no
  // session keep a generated id, as they did before.
  const id =
    recording.id ||
    (sessionId ? `session_${sessionId}` : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const entry = {
    title: recording.title || '',
    url: recording.url || '',
    date: recording.date || '',
    phaseId: recording.phaseId || '',
    sessionId,
    addedBy: recording.addedBy || null,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, GROUPS, groupId, RECORDINGS, id), entry, { merge: true });
  await updateDoc(doc(db, GROUPS, groupId), { updatedAt: serverTimestamp() });
  return { id, ...entry };
}

export async function deleteBatchRecordingDoc(groupId, recordingId) {
  if (!db) throw new Error('Firebase is not configured');
  await deleteDoc(doc(db, GROUPS, groupId, RECORDINGS, recordingId));
  await updateDoc(doc(db, GROUPS, groupId), { updatedAt: serverTimestamp() });
}

/**
 * Move a batch's legacy `recordings` array into the subcollection.
 *
 * Safe to run more than once: entries are keyed by session, so a second run
 * overwrites with the same values. The array is cleared only after every entry
 * has been written, so an interruption leaves the originals in place.
 */
export async function migrateBatchRecordings(groupId) {
  const group = await getGroup(groupId);
  const legacy = Array.isArray(group?.recordings) ? group.recordings : [];
  if (!legacy.length) return { moved: 0 };

  for (const rec of legacy) {
    // eslint-disable-next-line no-await-in-loop
    await saveBatchRecording(groupId, rec);
  }
  await updateDoc(doc(db, GROUPS, groupId), { recordings: [], updatedAt: serverTimestamp() });
  return { moved: legacy.length };
}

/**
 * Session recordings live on the batch (group) doc as a `recordings` array.
 * CX moderators can write groups, and batch members can read them — so no
 * Firestore rules change is needed. (serverTimestamp() is not allowed inside
 * array elements, so addedAt is a client ISO string.)
 *
 * Each entry may include phaseId (e.g. pre-preparation, onboarding) and
 * sessionId (program task id) so CX can attach unlisted YouTube links under
 * the correct session within a phase.
 */
export async function addBatchRecording(groupId, recording) {
  const entry = {
    id: recording.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: recording.title,
    url: recording.url,
    date: recording.date || '',
    phaseId: recording.phaseId || '',
    sessionId: recording.sessionId || '',
    addedBy: recording.addedBy || null,
    addedAt: new Date().toISOString(),
  };
  await updateDoc(doc(db, GROUPS, groupId), {
    recordings: arrayUnion(entry),
    updatedAt: serverTimestamp(),
  });
  return entry;
}

/**
 * One recording per sessionId on a batch — replaces duplicates and legacy rows
 * for the same session when CX adds or updates a link.
 */
export async function upsertBatchRecordingForSession(groupId, recording) {
  const group = await getGroup(groupId);
  if (!group) throw new Error('Batch not found');

  const { phaseId = '', sessionId = '' } = recording;
  if (!sessionId) {
    return addBatchRecording(groupId, recording);
  }

  const recordings = Array.isArray(group.recordings) ? group.recordings : [];
  const existing = recordings.find(
    (r) => r.sessionId === sessionId && (!phaseId || !r.phaseId || r.phaseId === phaseId)
  );

  const now = new Date().toISOString();
  const entry = existing
    ? {
        ...existing,
        title: recording.title,
        url: recording.url,
        date: recording.date || '',
        phaseId: phaseId || existing.phaseId || '',
        sessionId,
        addedBy: recording.addedBy ?? existing.addedBy ?? null,
        updatedAt: now,
      }
    : {
        id: recording.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: recording.title,
        url: recording.url,
        date: recording.date || '',
        phaseId,
        sessionId,
        addedBy: recording.addedBy || null,
        addedAt: now,
      };

  const next = recordings.filter((r) => r.sessionId !== sessionId || r.id === entry.id);
  if (!existing) next.push(entry);

  await updateDoc(doc(db, GROUPS, groupId), {
    recordings: existing ? next.map((r) => (r.id === entry.id ? entry : r)) : next,
    updatedAt: serverTimestamp(),
  });

  return entry;
}

export async function updateBatchRecording(groupId, recordingId, patch) {
  const group = await getGroup(groupId);
  if (!group) throw new Error('Batch not found');
  const recordings = Array.isArray(group.recordings) ? group.recordings : [];
  const idx = recordings.findIndex((r) => r.id === recordingId);
  if (idx < 0) throw new Error('Recording not found');

  const next = recordings.map((r, i) =>
    i === idx
      ? {
          ...r,
          ...patch,
          id: r.id,
          updatedAt: new Date().toISOString(),
        }
      : r
  );

  await updateDoc(doc(db, GROUPS, groupId), {
    recordings: next,
    updatedAt: serverTimestamp(),
  });
  return next[idx];
}

export async function removeBatchRecording(groupId, recording) {
  const group = await getGroup(groupId);
  if (!group) throw new Error('Batch not found');
  const recordings = Array.isArray(group.recordings) ? group.recordings : [];
  const next = recordings.filter((r) => r.id !== recording.id);

  // Prefer id-based remove so partial field mismatches (e.g. new phaseId) still work
  if (next.length !== recordings.length) {
    await updateDoc(doc(db, GROUPS, groupId), {
      recordings: next,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(doc(db, GROUPS, groupId), {
    recordings: arrayRemove(recording),
    updatedAt: serverTimestamp(),
  });
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
