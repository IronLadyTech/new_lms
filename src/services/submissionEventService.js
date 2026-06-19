import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDateKey } from '../utils/streakTimezone';
import { markPresentFromSubmission } from './attendanceService';

const LEARNER_SUBMISSIONS = 'learner_submissions';

function eventTimestampMillis(event) {
  const ts = event?.timestamp;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * @typedef {Object} SubmissionEvent
 * @property {string} learnerId
 * @property {string} courseId
 * @property {string|null} problemId
 * @property {boolean} isCorrect
 * @property {import('firebase/firestore').Timestamp|Date|number} timestamp
 */

/**
 * Record a submission event. Idempotent per learner/course/problem/day when dedupeKey is used.
 * @param {SubmissionEvent} payload
 */
export async function recordSubmissionEvent({
  learnerId,
  courseId,
  problemId,
  isCorrect,
  timestamp,
}) {
  if (!db || !learnerId) return null;

  const ts = timestamp || serverTimestamp();
  const dateKey = getDateKey(timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : new Date());
  const dedupeId = `${learnerId}_${courseId}_${problemId || 'general'}_${dateKey}_${isCorrect ? 'ok' : 'miss'}`;

  const ref = doc(db, LEARNER_SUBMISSIONS, dedupeId);
  await setDoc(
    ref,
    {
      learnerId,
      courseId: courseId || 'general',
      problemId: problemId || null,
      isCorrect: !!isCorrect,
      timestamp: ts,
      dateKey,
    },
    { merge: true }
  );

  if (isCorrect) {
    await markPresentFromSubmission(learnerId, courseId).catch(() => {});
  }

  return dedupeId;
}

export async function getSubmissionEvents(learnerId) {
  if (!db || !learnerId) return [];
  const q = query(collection(db, LEARNER_SUBMISSIONS), where('learnerId', '==', learnerId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => eventTimestampMillis(b) - eventTimestampMillis(a));
  return items;
}

/**
 * Real-time listener — Firebase push (WebSocket under the hood).
 * @returns {() => void} unsubscribe
 */
export function subscribeSubmissionEvents(learnerId, onData, onError) {
  if (!db || !learnerId) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, LEARNER_SUBMISSIONS), where('learnerId', '==', learnerId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => eventTimestampMillis(b) - eventTimestampMillis(a));
      onData(items);
    },
    (err) => {
      console.warn('Submission listener failed', err);
      onError?.(err);
    }
  );
}

/** Map legacy Firestore activities into submission events (real logged activity only). */
export function mapActivitiesToSubmissionEvents(activities = []) {
  const qualifyingTypes = new Set([
    'mock_test',
    'assignment_submit',
    'assignment',
    'resource_view',
    'course_enroll',
  ]);
  const qualifyingResourceTypes = new Set(['mock_test', 'assignment']);

  return activities
    .map((a) => {
      if (!a.userId || !a.createdAt) return null;
      const meta = a.metadata || {};
      const isMock = a.type === 'mock_test' || meta.resourceType === 'mock_test';
      const isAssignment =
        a.type === 'assignment_submit' ||
        a.type === 'assignment' ||
        meta.resourceType === 'assignment';
      const isPractice =
        isMock ||
        isAssignment ||
        qualifyingTypes.has(a.type) ||
        qualifyingResourceTypes.has(meta.resourceType);

      if (!isPractice) return null;

      const isCorrect = isMock || isAssignment ? meta.isCorrect !== false : true;
      if (!isCorrect) return null;

      return {
        id: `activity-${a.id}`,
        learnerId: a.userId,
        courseId: a.courseId || 'general',
        problemId: meta.problemId || meta.taskId || meta.resourceType || a.type || a.title || null,
        isCorrect: true,
        timestamp: a.createdAt,
        dateKey: getDateKey(a.createdAt.toDate?.() || a.createdAt),
        _legacy: true,
      };
    })
    .filter(Boolean);
}

/** Map MBW submission docs into qualifying events. */
export function mapMbwSubmissionsToEvents(submissions = [], learnerId) {
  const list = Array.isArray(submissions) ? submissions : Object.values(submissions || {});
  const qualifying = ['submitted', 'under_review', 'completed'];
  return submissions
    .filter((s) => qualifying.includes(s.status))
    .map((s) => ({
      id: `mbw-${s.taskId || s.id}`,
      learnerId: learnerId || s.userId,
      courseId: s.batchId || 'mbw',
      problemId: s.taskId,
      isCorrect: true,
      timestamp: s.submittedAt || s.completedAt || s.updatedAt || s.createdAt,
      dateKey: null,
      _legacy: true,
    }))
    .map((e) => ({
      ...e,
      dateKey: e.timestamp ? getDateKey(e.timestamp.toDate?.() || e.timestamp) : getDateKey(),
    }));
}

export function mergeSubmissionEvents(...lists) {
  const byKey = new Map();
  lists.flat().forEach((e) => {
    if (!e?.learnerId) return;
    const dateKey = e.dateKey || (e.timestamp ? getDateKey(e.timestamp.toDate?.() || e.timestamp) : '');
    const dedupeKey = `${e.learnerId}_${e.courseId || 'general'}_${e.problemId || 'general'}_${dateKey}_${e.isCorrect ? 'ok' : 'miss'}`;
    const existing = byKey.get(dedupeKey);
    if (!existing || (existing._legacy && !e._legacy)) {
      byKey.set(dedupeKey, { ...e, dateKey: dateKey || e.dateKey });
    }
  });
  return [...byKey.values()].sort((a, b) => eventTimestampMillis(b) - eventTimestampMillis(a));
}
