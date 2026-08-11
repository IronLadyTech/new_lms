import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getStaticTasks,
  getTasks,
  getUserSubmissions,
  saveSubmission,
  loadLocalSubmissions,
  SUBMISSION_STATUS,
  TASK_TYPES,
  currentWeekLabel,
} from '../services/mbwService';
import {
  canLearnerResubmit,
  submissionUnlocksNext,
  archiveReviewHistoryForResubmit,
  clearReviewFieldsForResubmit,
} from '../utils/submissionReview';
import { needsCloudUploadRetry } from '../utils/submissionMedia';

export const WATCH_THRESHOLD = 0.9;

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

function computeTaskStates(tasks, submissions, watchProgress) {
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
      (watchProgress[task.id] ?? sub?.watchProgress ?? 0) >= WATCH_THRESHOLD ||
      sub?.watchCompleted;

    const isWatchOnly = task.type === TASK_TYPES.WATCH_ONLY;

    return {
      task,
      submission: sub,
      status,
      watched,
      watchPercent: watchProgress[task.id] ?? sub?.watchProgress ?? 0,
      canSubmit: learnerCanSubmit(status, watched, isWatchOnly, task, sub),
      isComplete: isTaskComplete(status),
      prevTaskId: prevTask?.id || null,
    };
  });
}

export function useTaskEngine(userId) {
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
    () => computeTaskStates(tasks, submissions, watchProgress),
    [tasks, submissions, watchProgress]
  );

  const completedCount = taskStates.filter((t) => t.isComplete).length;

  const nextTaskState = useMemo(
    () =>
      taskStates.find(
        (t) => !submissionUnlocksNext(t.status) && t.status !== SUBMISSION_STATUS.LOCKED
      ),
    [taskStates]
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
    [tasks, submissions, userId, batchId]
  );

  const finalizeSubmitPayload = (payload, prevSubmission) => ({
    ...payload,
    ...archiveReviewHistoryForResubmit(prevSubmission),
    ...clearReviewFieldsForResubmit(prevSubmission),
  });

  const submitTask = useCallback(
    async (taskId, fields) => {
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

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
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
    [tasks, submissions, userId, batchId]
  );

  const saveTemplate = useCallback(
    async (taskId, templateData) => {
      const prevSubmission = submissions[taskId];
      const payload = finalizeSubmitPayload(
        {
          type: TASK_TYPES.EDITABLE_TEMPLATE,
          templateData,
          status: SUBMISSION_STATUS.SUBMITTED,
          submittedAt: new Date().toISOString(),
        },
        prevSubmission
      );

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      return {
        message: 'Submitted!',
        reviewRequired: false,
        taskId,
      };
    },
    [submissions, userId, batchId]
  );

  const addRecurringPost = useCallback(
    async (taskId, linkValue) => {
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
    [tasks, submissions, userId, batchId]
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
    getNextTaskId,
    getPrevTaskId,
    reload,
    setWatchProgressForTask,
    markWatchComplete,
    submitTask,
    saveTemplate,
    addRecurringPost,
    WATCH_THRESHOLD,
  };
}

export default useTaskEngine;
