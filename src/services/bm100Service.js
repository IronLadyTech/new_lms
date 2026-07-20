import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadFile } from './storageService';
import { loadLocalSubmissions, saveLocalSubmission, getLocalSubmission } from './bm100LocalStore';
import { recordSubmissionEvent } from './submissionEventService';
import {
  TASK_TYPES,
  SUBMISSION_STATUS,
  currentWeekLabel,
} from './mbwService';
import { getBm100StaticTasks } from '../data/bm100StaticTasks';
import { statusForReviewOutcome } from '../utils/submissionReview';
import { mergeInQuery } from '../utils/firestoreChunks';

export { loadLocalSubmissions, TASK_TYPES, SUBMISSION_STATUS, currentWeekLabel };

export const BM100_TASKS = 'bm100_tasks';
export const BM100_SUBMISSIONS = 'bm100_submissions';

/** CX reviews every finished learner task before it counts as complete. */
export const BM100_REVIEW_ENABLED = import.meta.env.VITE_BM100_REVIEW_ENABLED !== 'false';

// Cloud upload is on by default. Set VITE_BM100_STORAGE_ENABLED=false only for
// local/offline deployments; upload failures still fall back safely.
export const BM100_STORAGE_ENABLED = import.meta.env.VITE_BM100_STORAGE_ENABLED !== 'false';

/**
 * Whether submit should block the learner pending CX approval.
 * Reviews are optional — CX adds feedback only when needed.
 */
export function taskNeedsReview() {
  return false;
}

function submissionDocId(userId, taskId) {
  return `${userId}_${taskId}`;
}

export { submissionDocId };

export function getStaticTasks() {
  return getBm100StaticTasks();
}

export async function fetchFirestoreTasks() {
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, BM100_TASKS));
    if (snap.empty) return null;
    const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return null;
  }
}

export async function getTasks() {
  const staticTasks = getStaticTasks();
  const remote = await fetchFirestoreTasks();
  if (!remote?.length) return staticTasks;
  // Merge so a partial Firestore catalog cannot hide static lessons from CX review.
  const byId = new Map(staticTasks.map((t) => [t.id, t]));
  remote.forEach((t) => {
    byId.set(t.id, { ...(byId.get(t.id) || {}), ...t, id: t.id });
  });
  return [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getSubmission(userId, taskId) {
  const subId = submissionDocId(userId, taskId);
  if (db) {
    try {
      const snap = await getDoc(doc(db, BM100_SUBMISSIONS, subId));
      if (snap.exists()) return { id: snap.id, ...snap.data() };
    } catch {
      /* fall through to local */
    }
  }
  return getLocalSubmission(userId, taskId);
}

export async function getUserSubmissions(userId) {
  const map = { ...loadLocalSubmissions(userId) };
  if (db) {
    try {
      const q = query(collection(db, BM100_SUBMISSIONS), where('userId', '==', userId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        map[d.data().taskId] = { id: d.id, ...d.data() };
      });
    } catch {
      /* use local only */
    }
  }
  return map;
}

export async function getAllSubmissions() {
  if (!db) return Object.values(loadLocalSubmissions('all'));
  const snap = await getDocs(collection(db, BM100_SUBMISSIONS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * CX-scoped submissions — batch membership + pending review queue.
 * Avoids reading the entire bm100_submissions collection at 5k+ learners.
 */
export async function getSubmissionsForCx({ batchIds = [], includePending = true } = {}) {
  if (!db) return Object.values(loadLocalSubmissions('all'));

  const byId = new Map();
  const addSnap = (snap) => {
    snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  };

  const ids = [...batchIds];
  if (!ids.includes('default')) ids.push('default');

  const jobs = [];

  if (ids.length) {
    jobs.push(
      mergeInQuery(ids, async (chunk) => {
        const snap = await getDocs(
          query(collection(db, BM100_SUBMISSIONS), where('batchId', 'in', chunk))
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      })
        .then((map) => map.forEach((row, id) => byId.set(id, row)))
        .catch((err) => console.warn('CX 100BM submissions by batch failed', err?.code || err))
    );
  }

  if (includePending) {
    jobs.push(
      getDocs(
        query(
          collection(db, BM100_SUBMISSIONS),
          where('status', 'in', [
            SUBMISSION_STATUS.SUBMITTED,
            SUBMISSION_STATUS.UNDER_REVIEW,
            SUBMISSION_STATUS.NEEDS_IMPROVEMENT,
            SUBMISSION_STATUS.REJECTED,
          ])
        )
      )
        .then(addSnap)
        .catch((err) => console.warn('CX 100BM pending submissions failed', err?.code || err))
    );
  }

  await Promise.all(jobs);
  return [...byId.values()];
}

export async function saveSubmission(userId, taskId, payload, { batchId = 'default' } = {}) {
  const subId = submissionDocId(userId, taskId);
  const data = {
    taskId,
    userId,
    batchId,
    updatedAt: serverTimestamp(),
    ...payload,
  };

  if (db) {
    try {
      const ref = doc(db, BM100_SUBMISSIONS, subId);
      const writeData = getLocalSubmission(userId, taskId)
        ? data
        : { ...data, createdAt: serverTimestamp() };
      await setDoc(ref, writeData, { merge: true });
      const qualifying = [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW, SUBMISSION_STATUS.COMPLETED];
      if (qualifying.includes(payload.status)) {
        recordSubmissionEvent({
          learnerId: userId,
          courseId: batchId || '100bm',
          problemId: taskId,
          isCorrect: true,
        }).catch(() => {});
      }
      return { id: subId, ...payload, taskId, userId, batchId };
    } catch (err) {
      console.warn('Firestore save failed, using localStorage', err?.code, err?.message || err);
    }
  }

  return saveLocalSubmission(userId, taskId, { ...payload, batchId });
}

export async function uploadBm100File(userId, taskId, file, kind = 'file', options = {}) {
  if (!BM100_STORAGE_ENABLED) {
    return {
      url: null,
      path: null,
      fileName: file.name,
      localFallback: true,
      size: file.size,
      type: file.type,
    };
  }

  try {
    const { url, path, fileName } = await uploadFile(
      file,
      `bm100/${userId}/${taskId}/${kind}`,
      {
        uploadedBy: userId,
        source: 'bm100',
        sourceId: `${userId}_${taskId}`,
        sourceLabel: `100BM ${kind} — ${taskId}`,
      },
      options
    );
    return { url, path, fileName };
  } catch (err) {
    console.warn('Storage upload failed', err);
    return {
      url: null,
      path: null,
      fileName: file.name,
      localFallback: true,
      size: file.size,
      type: file.type,
    };
  }
}

export async function reviewSubmission(subId, { outcome, feedback, reviewerId }) {
  if (!db) throw new Error('Review requires Firestore');
  const status = statusForReviewOutcome(outcome);
  const approved = outcome === 'approved';
  await updateDoc(doc(db, BM100_SUBMISSIONS, subId), {
    status,
    reviewOutcome: outcome,
    feedback: feedback || '',
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
    completedAt: approved ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function updateTaskUnlockDate(taskId, unlockDate) {
  if (!db) throw new Error('Firestore required');
  await setDoc(
    doc(db, BM100_TASKS, taskId),
    { unlockDate, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
