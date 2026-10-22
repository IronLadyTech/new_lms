import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPhaseLockReason, LOCKED_BY } from '../utils/phaseLock';
import { PROGRAMS } from '../data/programTypes';
import { useAuth } from '../context/AuthContext';
import {
  getStaticTasks,
  getTasks,
  getUserSubmissions,
  saveSubmission,
  getSubmission,
  loadLocalSubmissions,
  SUBMISSION_STATUS,
  TASK_TYPES,
  currentWeekLabel,
} from '../services/lepService';
import { getUnlockedPhaseIds } from '../utils/lepProgramUtils';
import {
  canLearnerResubmit,
  submissionUnlocksNext,
  archiveReviewHistoryForResubmit,
  clearReviewFieldsForResubmit,
} from '../utils/submissionReview';
import { needsCloudUploadRetry } from '../utils/submissionMedia';
import { appendVersion, getSubmissionVersions, MAX_VERSIONS } from '../utils/submissionVersions';

/* Hand-ins a learner may reopen. A weekly post is added to, not edited. */
const EDITABLE_HAND_INS = new Set([
  TASK_TYPES.EDITABLE_TEMPLATE,
  TASK_TYPES.FILE_UPLOAD,
  TASK_TYPES.VIDEO_RECORD,
  TASK_TYPES.TEXT,
  TASK_TYPES.LINK,
]);

const REVIEW_STARTED_MESSAGE =
  'Your facilitator has already started reviewing this, so it can no longer be changed.';

export const LEP_WATCH_THRESHOLD = 0.9;

function learnerCanSubmit(status, watched, isWatchOnly, task, submission) {
  if (status === SUBMISSION_STATUS.LOCKED || isWatchOnly || !watched) return false;
  if (needsCloudUploadRetry(task, submission)) return true;
  if (status === SUBMISSION_STATUS.COMPLETED) return false;
  if (status === SUBMISSION_STATUS.SUBMITTED || status === SUBMISSION_STATUS.UNDER_REVIEW)
    return false;
  return canLearnerResubmit(status) || status === SUBMISSION_STATUS.UNLOCKED;
}

/** Fully done for learner UI — submitted counts as complete unless CX requests revision. */
function isTaskComplete(status) {
  return (
    status === SUBMISSION_STATUS.COMPLETED ||
    status === SUBMISSION_STATUS.SUBMITTED ||
    status === SUBMISSION_STATUS.UNDER_REVIEW
  );
}

function parseUnlockDate(unlockDate) {
  if (!unlockDate) return null;
  const d = new Date(unlockDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateUnlocked(unlockDate) {
  const d = parseUnlockDate(unlockDate);
  if (!d) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return today >= d;
}

/** Pass 1: sequential + date unlock only. */
function computeSequentialTaskStates(tasks, submissions, watchProgress) {
  return tasks.map((task, index) => {
    const sub = submissions[task.id];
    const prevTask = index > 0 ? tasks[index - 1] : null;
    const prevSub = prevTask ? submissions[prevTask.id] : null;

    let status = sub?.status || SUBMISSION_STATUS.LOCKED;

    const prevComplete =
      index === 0 || (prevTask && (prevTask.optional || submissionUnlocksNext(prevSub?.status)));

    const dateOk = isDateUnlocked(task.unlockDate);

    if (!prevComplete || !dateOk) {
      status = SUBMISSION_STATUS.LOCKED;
    } else if (!sub || status === SUBMISSION_STATUS.LOCKED) {
      status = SUBMISSION_STATUS.UNLOCKED;
    }

    const watched =
      !task.requiresWatch ||
      !task.videoUrl ||
      (watchProgress[task.id] ?? sub?.watchProgress ?? 0) >= LEP_WATCH_THRESHOLD ||
      sub?.watchCompleted;

    const isWatchOnly = task.type === TASK_TYPES.WATCH_ONLY;
    const complete = isTaskComplete(status);

    return {
      task,
      submission: sub,
      status,
      watched,
      watchPercent: watchProgress[task.id] ?? sub?.watchProgress ?? 0,
      canSubmit: learnerCanSubmit(status, watched, isWatchOnly, task, sub),
      isComplete: complete,
      /* Every hand-in, oldest first; an older submission reads as v1. */
      versions: getSubmissionVersions(sub),
      /* Handed in and not yet picked up by a facilitator: the learner may still edit. */
      canEdit: status === SUBMISSION_STATUS.SUBMITTED && EDITABLE_HAND_INS.has(task.type),
      prevTaskId: prevTask?.id || null,
      phaseLocked: false,
      lockedBy: null,
    };
  });
}

/**
 * Pass 2: lock incomplete tasks in payment/sequence-gated phases.
 * Completed work in a gated phase stays visible; new work cannot start.
 */
function applyPhaseGates(sequentialStates, profile) {
  const unlockedPhases = getUnlockedPhaseIds(sequentialStates, profile);
  /* Why a phase is shut, not merely that it is — see utils/phaseLock. */
  const reasonFor = buildPhaseLockReason(
    getUnlockedPhaseIds,
    sequentialStates,
    profile,
    PROGRAMS.LEP
  );

  return sequentialStates.map((ts) => {
    if (unlockedPhases.has(ts.task.phase) || ts.isComplete) {
      return { ...ts, phaseLocked: false, lockedBy: null };
    }
    return {
      ...ts,
      status: SUBMISSION_STATUS.LOCKED,
      canSubmit: false,
      canEdit: false,
      phaseLocked: true,
      lockedBy: reasonFor(ts.task.phase),
    };
  });
}

function computeTaskStates(tasks, submissions, watchProgress, profile) {
  const sequential = computeSequentialTaskStates(tasks, submissions, watchProgress);
  return applyPhaseGates(sequential, profile);
}

export default function useLepTaskEngine(userId) {
  const { profile } = useAuth();
  const batchId = profile?.batchId || 'default';

  const [tasks, setTasks] = useState(() => getStaticTasks());
  const [submissions, setSubmissions] = useState(() =>
    userId ? loadLocalSubmissions(userId) : {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [watchProgress, setWatchProgress] = useState({});
  const watchPendingRef = useRef({});
  const watchPersistTimersRef = useRef({});

  const flushWatchProgress = useCallback(
    async (taskId) => {
      const fraction = watchPendingRef.current[taskId];
      if (fraction == null || !userId) return;
      delete watchPendingRef.current[taskId];

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const payload = {
        type: task.type,
        watchProgress: fraction,
        status: submissions[taskId]?.status || SUBMISSION_STATUS.UNLOCKED,
      };

      try {
        const saved = await saveSubmission(userId, taskId, payload, { batchId });
        setSubmissions((prev) => ({
          ...prev,
          [taskId]: { ...prev[taskId], ...saved, ...payload },
        }));
      } catch {
        /* localStorage fallback inside saveSubmission */
      }
    },
    [userId, tasks, submissions, batchId]
  );

  const flushAllWatchProgress = useCallback(() => {
    Object.keys(watchPendingRef.current).forEach((taskId) => {
      if (watchPersistTimersRef.current[taskId]) {
        clearTimeout(watchPersistTimersRef.current[taskId]);
        delete watchPersistTimersRef.current[taskId];
      }
      flushWatchProgress(taskId);
    });
  }, [flushWatchProgress]);

  useEffect(() => {
    const onHide = () => flushAllWatchProgress();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      flushAllWatchProgress();
    };
  }, [flushAllWatchProgress]);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setError('');
    setTasks(getStaticTasks());
    setSubmissions(loadLocalSubmissions(userId));
    setLoading(false);

    try {
      const taskList = await Promise.race([
        getTasks(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);
      if (taskList?.length) setTasks(taskList);
    } catch {
      /* static tasks already shown */
    }

    try {
      const subs = await getUserSubmissions(userId);
      setSubmissions((prev) => ({ ...prev, ...subs }));
      const restored = {};
      Object.entries(subs).forEach(([taskId, sub]) => {
        if (typeof sub?.watchProgress === 'number' && sub.watchProgress > 0) {
          restored[taskId] = sub.watchProgress;
        }
      });
      setWatchProgress(restored);
    } catch (e) {
      setError(
        e.message === 'timeout' ? '' : 'Could not sync submissions. Showing saved local data.'
      );
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const taskStates = useMemo(
    () => computeTaskStates(tasks, submissions, watchProgress, profile),
    [tasks, submissions, watchProgress, profile]
  );

  const completedCount = taskStates.filter((t) => t.isComplete).length;

  const nextTaskState = useMemo(
    () =>
      taskStates.find(
        (t) => !submissionUnlocksNext(t.status) && t.status !== SUBMISSION_STATUS.LOCKED
      ),
    [taskStates]
  );

  /** True when registration access has run out of open work and the rest is payment-locked. */
  const awaitingFullPayment = useMemo(() => {
    if (nextTaskState) return false;
    return taskStates.some((t) => t.phaseLocked && !t.isComplete);
  }, [taskStates, nextTaskState]);

  const getTaskState = useCallback(
    (taskId) => taskStates.find((t) => t.task.id === taskId) || null,
    [taskStates]
  );

  const refuseIfPhaseLocked = useCallback(
    (taskId) => {
      const ts = getTaskState(taskId);
      if (ts?.phaseLocked) {
        /*
         * Both reasons used to come out as "pay up". A learner who had paid in
         * full but had not finished the phase before it was told to pay again.
         */
        const byPayment = ts.lockedBy === LOCKED_BY.PAYMENT;
        return {
          message: byPayment
            ? 'This section needs full program payment. Registration covers Pre-Program Preparation through Day 2. Completing payment opens the rest.'
            : 'Finish the phase before this one and it opens on its own.',
          reviewRequired: false,
          taskId,
          blocked: true,
          paymentRequired: byPayment,
        };
      }
      if (ts?.status === SUBMISSION_STATUS.LOCKED) {
        return {
          message: 'This lesson is still locked. Complete the previous lesson first.',
          reviewRequired: false,
          taskId,
          blocked: true,
        };
      }
      return null;
    },
    [getTaskState]
  );

  const getNextTaskId = useCallback(
    (currentTaskId) => {
      const idx = taskStates.findIndex((t) => t.task.id === currentTaskId);
      if (idx < 0) return nextTaskState?.task.id || null;
      for (let i = idx + 1; i < taskStates.length; i += 1) {
        if (taskStates[i].status !== SUBMISSION_STATUS.LOCKED) return taskStates[i].task.id;
      }
      return null;
    },
    [taskStates, nextTaskState]
  );

  /** Next lesson in sequence even if payment-locked — used for reminder copy. */
  const getNextSequentialTaskState = useCallback(
    (currentTaskId) => {
      const idx = taskStates.findIndex((t) => t.task.id === currentTaskId);
      if (idx < 0 || idx >= taskStates.length - 1) return null;
      return taskStates[idx + 1];
    },
    [taskStates]
  );

  const getPrevTaskId = useCallback(
    (currentTaskId) => {
      const idx = taskStates.findIndex((t) => t.task.id === currentTaskId);
      if (idx <= 0) return null;
      return taskStates[idx - 1].task.id;
    },
    [taskStates]
  );

  const setWatchProgressForTask = useCallback(
    (taskId, fraction) => {
      setWatchProgress((prev) => {
        const next = Math.max(prev[taskId] ?? 0, fraction);
        watchPendingRef.current[taskId] = next;
        return { ...prev, [taskId]: next };
      });

      if (!watchPersistTimersRef.current[taskId]) {
        watchPersistTimersRef.current[taskId] = setTimeout(() => {
          delete watchPersistTimersRef.current[taskId];
          flushWatchProgress(taskId);
        }, 15000);
      }
    },
    [flushWatchProgress]
  );

  const markWatchComplete = useCallback(
    async (taskId) => {
      const blocked = refuseIfPhaseLocked(taskId);
      if (blocked) return blocked;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const payload = {
        type: task.type,
        status:
          task.type === TASK_TYPES.WATCH_ONLY
            ? SUBMISSION_STATUS.SUBMITTED
            : submissions[taskId]?.status || SUBMISSION_STATUS.UNLOCKED,
        watchCompleted: true,
        watchProgress: 1,
      };

      if (task.type === TASK_TYPES.WATCH_ONLY) {
        payload.submittedAt = new Date().toISOString();
      }

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      if (task.type === TASK_TYPES.WATCH_ONLY) {
        return {
          message: 'Submitted!',
          reviewRequired: false,
          taskId,
        };
      }
      return null;
    },
    [tasks, submissions, userId, batchId, refuseIfPhaseLocked]
  );

  const finalizeSubmitPayload = (payload, prevSubmission) => ({
    ...payload,
    ...archiveReviewHistoryForResubmit(prevSubmission),
    ...clearReviewFieldsForResubmit(prevSubmission),
  });

  /*
   * Hand-in of an assignment: add it as the next version.
   *
   * The submission is read fresh first. The copy in memory can be stale: the
   * learner may have resubmitted on another device, or a facilitator may have
   * opened it since the page loaded. Building on the stored list keeps earlier
   * versions exactly as they are, which the security rules insist on; and work
   * already under review is refused here with a reason, before the rules would
   * refuse it without one.
   */
  const prepareHandIn = useCallback(
    async (taskId, task, payload, prevSubmission) => {
      /*
       * Versions are kept for anything a learner hands in and can hand in again:
       * a worksheet, a file, a recording, a written answer or a link. A weekly
       * post is added to rather than replaced, and a checklist is ticked, so
       * neither carries versions.
       */
      const isHandIn = payload.status === SUBMISSION_STATUS.SUBMITTED;
      if (!isHandIn || !EDITABLE_HAND_INS.has(task?.type ?? payload.type)) {
        return { payload };
      }
      const fresh = prevSubmission ? await getSubmission(userId, taskId).catch(() => null) : null;
      const base = fresh || prevSubmission;
      if (base?.status === SUBMISSION_STATUS.UNDER_REVIEW) {
        return {
          refused: { message: REVIEW_STARTED_MESSAGE, reviewRequired: false, taskId, blocked: true },
        };
      }
      if (getSubmissionVersions(base).length >= MAX_VERSIONS) {
        return {
          refused: {
            message: `This lesson already has ${MAX_VERSIONS} versions, which is the most it can keep.`,
            reviewRequired: false,
            taskId,
            blocked: true,
          },
        };
      }
      return { payload: { ...payload, versions: appendVersion(base, payload) } };
    },
    [userId]
  );

  /* A write the rules refused, as the learner should hear it. */
  const refusedBySave = (err, taskId) => {
    if (err?.code !== 'permission-denied') throw err;
    return { message: REVIEW_STARTED_MESSAGE, reviewRequired: false, taskId, blocked: true };
  };

  const submitTask = useCallback(
    async (taskId, fields) => {
      const blocked = refuseIfPhaseLocked(taskId);
      if (blocked) return blocked;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const prevSubmission = submissions[taskId];
      let payload = {
        type: task.type,
        status: SUBMISSION_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
        ...fields,
      };

      if (task.type === TASK_TYPES.CHECKLIST) {
        const total = task.checklistItems?.length || 0;
        const ticked = Array.isArray(fields.checkedItems) ? fields.checkedItems.length : 0;
        if (total > 0 && ticked >= total) {
          payload.status = SUBMISSION_STATUS.SUBMITTED;
        } else {
          payload.status = SUBMISSION_STATUS.UNLOCKED;
        }
      }

      payload = finalizeSubmitPayload(payload, prevSubmission);

      const prepared = await prepareHandIn(taskId, task, payload, prevSubmission);
      if (prepared.refused) return prepared.refused;
      payload = prepared.payload;

      let saved;
      try {
        saved = await saveSubmission(userId, taskId, payload, { batchId });
      } catch (err) {
        return refusedBySave(err, taskId);
      }
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      if (task.type === TASK_TYPES.CHECKLIST && payload.status !== SUBMISSION_STATUS.SUBMITTED) {
        return null;
      }
      return {
        message: 'Submitted!',
        reviewRequired: false,
        taskId,
      };
    },
    [tasks, submissions, userId, batchId, refuseIfPhaseLocked, prepareHandIn]
  );

  const saveTemplate = useCallback(
    async (taskId, templateData) => {
      const blocked = refuseIfPhaseLocked(taskId);
      if (blocked) return blocked;

      const finalized = finalizeSubmitPayload(
        {
          type: TASK_TYPES.EDITABLE_TEMPLATE,
          templateData,
          status: SUBMISSION_STATUS.SUBMITTED,
          submittedAt: new Date().toISOString(),
        },
        submissions[taskId]
      );

      const task = tasks.find((t) => t.id === taskId);
      const prepared = await prepareHandIn(taskId, task, finalized, submissions[taskId]);
      if (prepared.refused) return prepared.refused;
      const payload = prepared.payload;

      let saved;
      try {
        saved = await saveSubmission(userId, taskId, payload, { batchId });
      } catch (err) {
        return refusedBySave(err, taskId);
      }
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      return {
        message: payload.versions?.length > 1 ? 'Resubmitted!' : 'Submitted!',
        reviewRequired: false,
        taskId,
      };
    },
    [tasks, submissions, userId, batchId, refuseIfPhaseLocked, prepareHandIn]
  );

  const addRecurringPost = useCallback(
    async (taskId, linkValue) => {
      const blocked = refuseIfPhaseLocked(taskId);
      if (blocked) return blocked;

      const task = tasks.find((t) => t.id === taskId);
      const weekLabel = currentWeekLabel();
      const existing = submissions[taskId]?.weekEntries || [];
      const thisWeekEntry = existing.find((e) => e.weekLabel === weekLabel);
      const prevLinks =
        thisWeekEntry?.links || (thisWeekEntry?.linkValue ? [thisWeekEntry.linkValue] : []);
      const links = linkValue ? [...prevLinks, linkValue] : prevLinks;
      const mergedEntry = {
        weekLabel,
        links,
        linkValue: links[links.length - 1] || '',
        submittedAt: new Date().toISOString(),
      };
      const updatedEntries = [...existing.filter((e) => e.weekLabel !== weekLabel), mergedEntry];
      const postsNeeded = task?.postsPerWeek || 1;
      const met = links.length >= postsNeeded;

      const payload = finalizeSubmitPayload(
        {
          type: TASK_TYPES.RECURRING_POST,
          weekEntries: updatedEntries,
          linkValue: mergedEntry.linkValue,
          status: met ? SUBMISSION_STATUS.SUBMITTED : SUBMISSION_STATUS.UNLOCKED,
          submittedAt: new Date().toISOString(),
        },
        submissions[taskId]
      );

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      return {
        message: met ? 'Weekly post goal met — submitted!' : 'Post link saved for this week.',
        reviewRequired: false,
        taskId,
      };
    },
    [tasks, submissions, userId, batchId, refuseIfPhaseLocked]
  );

  return {
    tasks,
    taskStates,
    submissions,
    loading,
    error,
    completedCount,
    totalTasks: tasks.length,
    nextTaskState,
    awaitingFullPayment,
    getNextTaskId,
    getNextSequentialTaskState,
    getPrevTaskId,
    reload,
    setWatchProgressForTask,
    markWatchComplete,
    submitTask,
    saveTemplate,
    addRecurringPost,
    WATCH_THRESHOLD: LEP_WATCH_THRESHOLD,
  };
}
