import { useCallback, useEffect, useMemo, useState } from 'react';
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
  taskNeedsReview,
} from '../services/mbwService';

export const WATCH_THRESHOLD = 0.9;

function isTaskComplete(status, reviewRequired) {
  if (status === SUBMISSION_STATUS.COMPLETED) return true;
  if (!taskNeedsReview({ reviewRequired }) && status === SUBMISSION_STATUS.SUBMITTED) return true;
  if (!taskNeedsReview({ reviewRequired }) && status === SUBMISSION_STATUS.UNDER_REVIEW) return true;
  return false;
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
      index === 0 ||
      (prevTask &&
        (prevTask.optional || isTaskComplete(prevSub?.status, prevTask.reviewRequired)));

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
      canSubmit: status !== SUBMISSION_STATUS.LOCKED && watched && !isWatchOnly,
      isComplete: isTaskComplete(status, task.reviewRequired),
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
    } catch (e) {
      setError(e.message === 'timeout' ? '' : 'Could not sync submissions. Showing saved local data.');
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
    () => taskStates.find((t) => !t.isComplete && t.status !== SUBMISSION_STATUS.LOCKED),
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

  const setWatchProgressForTask = useCallback((taskId, fraction) => {
    setWatchProgress((prev) => ({ ...prev, [taskId]: Math.max(prev[taskId] ?? 0, fraction) }));
  }, []);

  const markWatchComplete = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const payload = {
        type: task.type,
        status:
          task.type === TASK_TYPES.WATCH_ONLY
            ? SUBMISSION_STATUS.COMPLETED
            : submissions[taskId]?.status || SUBMISSION_STATUS.UNLOCKED,
        watchCompleted: true,
        watchProgress: 1,
        completedAt: task.type === TASK_TYPES.WATCH_ONLY ? new Date().toISOString() : null,
      };

      if (task.type === TASK_TYPES.WATCH_ONLY) {
        payload.submittedAt = new Date().toISOString();
      }

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      if (task.type === TASK_TYPES.WATCH_ONLY) {
        return {
          message: 'Orientation complete!',
          reviewRequired: false,
          taskId,
        };
      }
      return null;
    },
    [tasks, submissions, userId, batchId]
  );

  const submitTask = useCallback(
    async (taskId, fields) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const payload = {
        type: task.type,
        status: SUBMISSION_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
        ...fields,
      };

      if (taskNeedsReview(task)) {
        payload.status = SUBMISSION_STATUS.UNDER_REVIEW;
      } else {
        payload.status = SUBMISSION_STATUS.COMPLETED;
        payload.completedAt = new Date().toISOString();
      }

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      const needsReview = taskNeedsReview(task);
      return {
        message: needsReview
          ? 'Submitted — your instructor will review it soon.'
          : 'Saved successfully!',
        reviewRequired: needsReview,
        taskId,
      };
    },
    [tasks, userId, batchId]
  );

  const saveTemplate = useCallback(
    async (taskId, templateData) => {
      const task = tasks.find((t) => t.id === taskId);
      const payload = {
        type: TASK_TYPES.EDITABLE_TEMPLATE,
        templateData,
        status: submissions[taskId]?.status || SUBMISSION_STATUS.UNLOCKED,
      };

      if (!taskNeedsReview(task)) {
        payload.status = SUBMISSION_STATUS.COMPLETED;
        payload.completedAt = new Date().toISOString();
        payload.submittedAt = new Date().toISOString();
      } else {
        payload.status = SUBMISSION_STATUS.UNDER_REVIEW;
        payload.submittedAt = new Date().toISOString();
      }

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      const needsReview = taskNeedsReview(task);
      return {
        message: needsReview ? 'ERRC grid submitted for review.' : 'ERRC grid saved!',
        reviewRequired: needsReview,
        taskId,
      };
    },
    [tasks, submissions, userId, batchId]
  );

  const addRecurringPost = useCallback(
    async (taskId, linkValue) => {
      const task = tasks.find((t) => t.id === taskId);
      const weekLabel = currentWeekLabel();
      const existing = submissions[taskId]?.weekEntries || [];
      const thisWeekEntry = existing.find((e) => e.weekLabel === weekLabel);
      const prevLinks = thisWeekEntry?.links || (thisWeekEntry?.linkValue ? [thisWeekEntry.linkValue] : []);
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

      const payload = {
        type: TASK_TYPES.RECURRING_POST,
        weekEntries: updatedEntries,
        linkValue: mergedEntry.linkValue,
        status: met ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
        completedAt: met ? new Date().toISOString() : null,
      };

      const saved = await saveSubmission(userId, taskId, payload, { batchId });
      setSubmissions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...saved, ...payload } }));

      return {
        message: met ? 'Weekly post goal met — great work!' : 'Post link saved for this week.',
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
