import { useCallback, useEffect, useRef, useState } from 'react';
import {
  countSubmissions,
  getSubmissionsPage,
  CX_QUEUE_STATUSES,
  CX_COMPLETE_STATUSES,
} from '../services/cxQueueService';
import { getUsersByIds } from '../services/userService';

/** How many queue items the home panel previews. The count never uses this. */
export const ATTENTION_PREVIEW_COUNT = 8;

/**
 * The home page's queue and completion figure, without reading the programme.
 *
 * Learners are still fetched in full by useCxData — a thousand of them load in
 * about a second, and the participant count has to stay exact. Submissions are
 * the expensive part (eight per learner), so they are never fetched here: the
 * backlog is a count, the preview is eight rows, and the completed-work figure
 * is one count per active task.
 */
export function useCxAttention({ collectionName, enabled = true, activeTaskIds = [] }) {
  const [items, setItems] = useState([]);
  const [learners, setLearners] = useState({});
  const [total, setTotal] = useState(null);
  const [completedCells, setCompletedCells] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  // Depend on the contents, not the array identity, or this reloads every render.
  const taskKey = activeTaskIds.join(',');

  const load = useCallback(async () => {
    if (!enabled || !collectionName) {
      setItems([]);
      setTotal(0);
      setCompletedCells(null);
      setLoading(false);
      return;
    }

    const token = ++requestRef.current;
    setLoading(true);
    setError('');
    const taskIds = taskKey ? taskKey.split(',') : [];

    try {
      const [page, count] = await Promise.all([
        getSubmissionsPage(collectionName, {
          statuses: CX_QUEUE_STATUSES,
          pageSize: ATTENTION_PREVIEW_COUNT,
          oldestFirst: true,
        }),
        countSubmissions(collectionName, { statuses: CX_QUEUE_STATUSES }),
      ]);
      if (requestRef.current !== token) return;

      setItems(page.rows);
      setTotal(count);
      setLoading(false);

      const ids = [...new Set(page.rows.map((r) => r.userId).filter(Boolean))];
      if (ids.length) {
        const found = await getUsersByIds(ids);
        if (requestRef.current === token) {
          setLearners(Object.fromEntries(found.map((u) => [u.id, u])));
        }
      }

      /*
       * One count per active task, because a status list and a task list cannot
       * both be range filters in the same query. There are a dozen or so tasks,
       * they run together, and a count costs a fraction of a read — far cheaper
       * than the eight thousand documents this replaces.
       */
      if (taskIds.length) {
        const perTask = await Promise.all(
          taskIds.map((taskId) =>
            countSubmissions(collectionName, { statuses: CX_COMPLETE_STATUSES, taskId })
          )
        );
        if (requestRef.current !== token) return;
        setCompletedCells(
          perTask.some((n) => n === null) ? null : perTask.reduce((a, b) => a + b, 0)
        );
      } else {
        setCompletedCells(0);
      }
    } catch (e) {
      if (requestRef.current !== token) return;
      console.error(e);
      setError('Could not load the attention queue.');
      setLoading(false);
    }
  }, [collectionName, enabled, taskKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, learners, total, completedCells, loading, error, refresh: load };
}
