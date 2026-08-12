import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countSubmissions,
  getSubmissionsPage,
  CX_VISIBLE_STATUSES,
  CX_PENDING_STATUSES,
  CX_ACTION_STATUSES,
  CX_QUEUE_STATUSES,
} from '../services/cxQueueService';
import { getUsersByIds } from '../services/userService';

/** Queue filters, and the statuses each one asks the database for. */
export const QUEUE_STATUS_SETS = {
  all: CX_VISIBLE_STATUSES,
  pending: CX_PENDING_STATUSES,
  action: CX_ACTION_STATUSES,
};

const PAGE_SIZE = 50;

/**
 * Name the cause when we can.
 *
 * The paged queue needs composite indexes. If the code reaches production
 * before they finish building, every read fails, and "check your connection"
 * would send whoever is on call looking in the wrong place entirely.
 */
function describeQueueError(err) {
  const message = String(err?.message || '');
  if (err?.code === 'failed-precondition' || /index/i.test(message)) {
    return 'The review queue needs a database index that is missing or still building. It usually finishes within a few minutes of being deployed.';
  }
  if (err?.code === 'permission-denied') {
    return 'You do not have access to this review queue. If you are a moderator, deploy the latest Firestore rules.';
  }
  return 'Could not load the review queue. Check your connection and try again.';
}

/**
 * The review queue, read a page at a time.
 *
 * The three headline counts come from the database as counts, so they describe
 * the whole queue however large it is, while the page only carries the rows
 * actually on screen. Learners are then fetched for that page alone rather than
 * for the entire programme.
 */
export function useCxReviewQueue({ collectionName, queueFilter = 'all', batchId = 'all' }) {
  const [rows, setRows] = useState([]);
  const [learners, setLearners] = useState({});
  const [counts, setCounts] = useState({ all: null, pending: null, action: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const cursorRef = useRef(null);
  // Guards against a slow first page landing after the filters have moved on.
  const requestRef = useRef(0);

  const statuses = QUEUE_STATUS_SETS[queueFilter] || CX_VISIBLE_STATUSES;

  /** Fetches only the learners referenced by the rows just loaded. */
  const attachLearners = useCallback(async (newRows, token) => {
    const ids = [...new Set(newRows.map((r) => r.userId).filter(Boolean))];
    if (!ids.length) return;
    try {
      const found = await getUsersByIds(ids);
      if (requestRef.current !== token) return;
      setLearners((prev) => {
        const next = { ...prev };
        found.forEach((u) => {
          next[u.id] = u;
        });
        return next;
      });
    } catch {
      /* a row without its learner is filtered out rather than shown blank */
    }
  }, []);

  const loadFirstPage = useCallback(async () => {
    const token = ++requestRef.current;
    setLoading(true);
    setError('');
    cursorRef.current = null;

    try {
      const [page, all, pending, action] = await Promise.all([
        getSubmissionsPage(collectionName, { statuses, batchId, pageSize: PAGE_SIZE }),
        countSubmissions(collectionName, { statuses: CX_VISIBLE_STATUSES, batchId }),
        countSubmissions(collectionName, { statuses: CX_PENDING_STATUSES, batchId }),
        countSubmissions(collectionName, { statuses: CX_ACTION_STATUSES, batchId }),
      ]);
      if (requestRef.current !== token) return;

      cursorRef.current = page.cursor;
      setRows(page.rows);
      setDone(page.done);
      setCounts({ all, pending, action });
      await attachLearners(page.rows, token);
    } catch (e) {
      if (requestRef.current !== token) return;
      console.error(e);
      setError(describeQueueError(e));
    } finally {
      if (requestRef.current === token) setLoading(false);
    }
  }, [collectionName, statuses, batchId, attachLearners]);

  const loadMore = useCallback(async () => {
    if (loadingMore || done || !cursorRef.current) return;
    const token = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await getSubmissionsPage(collectionName, {
        statuses,
        batchId,
        pageSize: PAGE_SIZE,
        cursor: cursorRef.current,
      });
      if (requestRef.current !== token) return;

      cursorRef.current = page.cursor;
      setRows((prev) => [...prev, ...page.rows]);
      setDone(page.done);
      await attachLearners(page.rows, token);
    } catch (e) {
      console.error(e);
      setError('Could not load more submissions.');
    } finally {
      if (requestRef.current === token) setLoadingMore(false);
    }
  }, [collectionName, statuses, batchId, done, loadingMore, attachLearners]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  /** The count for the filter currently being viewed. */
  const totalForFilter = useMemo(() => {
    if (queueFilter === 'pending') return counts.pending;
    if (queueFilter === 'action') return counts.action;
    return counts.all;
  }, [queueFilter, counts]);

  return {
    rows,
    learners,
    counts,
    totalForFilter,
    loading,
    loadingMore,
    error,
    done,
    loadMore,
    refresh: loadFirstPage,
  };
}

export { CX_QUEUE_STATUSES, PAGE_SIZE };
