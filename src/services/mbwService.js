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
import { loadLocalSubmissions, saveLocalSubmission, getLocalSubmission } from './mbwLocalStore';

export { loadLocalSubmissions };

export const MBW_TASKS = 'mbw_tasks';
export const MBW_SUBMISSIONS = 'mbw_submissions';

export const TASK_TYPES = {
  WATCH_ONLY: 'watch_only',
  TEXT: 'text',
  LINK: 'link',
  EDITABLE_TEMPLATE: 'editable_template',
  FILE_UPLOAD: 'file_upload',
  VIDEO_RECORD: 'video_record',
  RECURRING_POST: 'recurring_post',
};

export const SUBMISSION_STATUS = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  COMPLETED: 'completed',
};

/** Instructor review workflow — off for now; set true when admin review is re-enabled. */
export const MBW_REVIEW_ENABLED = false;

/** Firebase Storage uploads — off until storage is configured. */
export const MBW_STORAGE_ENABLED = false;

export function taskNeedsReview(task) {
  return MBW_REVIEW_ENABLED && !!task?.reviewRequired;
}

/** Pre-session task definitions (static — admin can override unlockDate in Firestore later). */
export const PRE_SESSION_TASKS = [
  {
    id: 'mbw-orientation',
    order: 0,
    week: 'Orientation',
    title: 'Orientation Session (by Rajesh)',
    type: TASK_TYPES.WATCH_ONLY,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the orientation session to begin your MBW journey.',
  },
  {
    id: 'mbw-principles',
    order: 1,
    week: 'Wk1-12',
    title: '27 Principles Video',
    type: TASK_TYPES.TEXT,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the video, then submit 3 key learnings.',
    placeholder: 'Enter your 3 key learnings…',
  },
  {
    id: 'mbw-csuite',
    order: 2,
    week: 'Wk1-11',
    title: 'C-Suite Talk — Topic Finalization',
    type: TASK_TYPES.TEXT,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: true,
    description: 'Watch the session and submit your chosen talk topic for review.',
    placeholder: 'Your chosen C-Suite talk topic…',
  },
  {
    id: 'mbw-errc',
    order: 3,
    week: 'Wk1-10',
    title: 'ERRC Framework',
    type: TASK_TYPES.EDITABLE_TEMPLATE,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the ERRC video, then fill your activity grid (editable anytime).',
  },
  {
    id: 'mbw-linkedin-profile',
    order: 4,
    week: 'Wk1-9',
    title: 'LinkedIn Profile Update',
    type: TASK_TYPES.LINK,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Update your LinkedIn profile, then paste your profile URL here.',
    linkLabel: 'LinkedIn profile URL',
  },
  {
    id: 'mbw-linkedin-connects',
    order: 5,
    week: 'Wk1-8',
    title: 'LinkedIn Connects (Networking)',
    type: TASK_TYPES.RECURRING_POST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Post on LinkedIn weekly and paste your post link. Builds your leadership brand.',
    postsPerWeek: 1,
  },
  {
    id: 'mbw-objectives',
    order: 6,
    week: 'Wk1-7',
    title: 'Objectives (Bhag)',
    type: TASK_TYPES.TEXT,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Write your personal objectives — your Bhag.',
    placeholder: 'Your objectives…',
  },
  {
    id: 'mbw-resume',
    order: 7,
    week: 'Wk1-6',
    title: 'Resume Updation',
    type: TASK_TYPES.FILE_UPLOAD,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    optional: true,
    description: 'Watch the guidance video, then upload your updated resume when ready.',
    accept: '.pdf,.doc,.docx',
  },
  {
    id: 'mbw-live-session',
    order: 8,
    week: 'Live',
    title: 'Live Session',
    type: TASK_TYPES.WATCH_ONLY,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Attend / watch the live session recording.',
  },
  {
    id: 'mbw-mirror',
    order: 9,
    week: 'Wk1-5',
    title: 'Mirror Practice',
    type: TASK_TYPES.VIDEO_RECORD,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Record your mirror practice in the LMS or upload a video file.',
  },
  {
    id: 'mbw-lep',
    order: 10,
    week: 'LEP',
    title: 'LEP Video',
    type: TASK_TYPES.TEXT,
    requiresWatch: true,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Watch the LEP video and share 3–5 key points.',
    placeholder: 'Share 3–5 key points from the LEP video…',
  },
  {
    id: 'mbw-networking-continued',
    order: 11,
    week: 'Networking',
    title: 'Networking Continued',
    type: TASK_TYPES.RECURRING_POST,
    requiresWatch: false,
    videoUrl: '',
    unlockDate: null,
    reviewRequired: false,
    description: 'Continue networking — submit 2 LinkedIn post links this week.',
    postsPerWeek: 2,
    continuesTaskId: 'mbw-linkedin-connects',
  },
];

export function submissionDocId(userId, taskId) {
  return `${userId}_${taskId}`;
}

export function currentWeekLabel(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - start) / 86_400_000 + start.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getStaticTasks() {
  return [...PRE_SESSION_TASKS].sort((a, b) => a.order - b.order);
}

export async function fetchFirestoreTasks() {
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, MBW_TASKS));
    if (snap.empty) return null;
    const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return null;
  }
}

export async function getTasks() {
  const remote = await fetchFirestoreTasks();
  return remote?.length ? remote : getStaticTasks();
}

export async function getSubmission(userId, taskId) {
  const subId = submissionDocId(userId, taskId);
  if (db) {
    try {
      const snap = await getDoc(doc(db, MBW_SUBMISSIONS, subId));
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
      const q = query(collection(db, MBW_SUBMISSIONS), where('userId', '==', userId));
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
  const snap = await getDocs(collection(db, MBW_SUBMISSIONS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      const ref = doc(db, MBW_SUBMISSIONS, subId);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, data);
      } else {
        await setDoc(ref, { ...data, createdAt: serverTimestamp() });
      }
      return { id: subId, ...payload, taskId, userId, batchId };
    } catch (err) {
      console.warn('Firestore save failed, using localStorage', err);
    }
  }

  return saveLocalSubmission(userId, taskId, { ...payload, batchId });
}

export async function uploadMbwFile(userId, taskId, file, kind = 'file') {
  try {
    const { url, path, fileName } = await uploadFile(file, `mbw/${userId}/${taskId}/${kind}`);
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

export async function reviewSubmission(subId, { approved, feedback, reviewerId }) {
  if (!db) throw new Error('Review requires Firestore');
  const status = approved ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.UNLOCKED;
  await updateDoc(doc(db, MBW_SUBMISSIONS, subId), {
    status,
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
    doc(db, MBW_TASKS, taskId),
    { unlockDate, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
