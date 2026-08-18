import { useEffect, useState } from 'react';
import { fetchLessonAsset } from '../services/lessonAssetService';

/**
 * A lesson's media URL, fetched when the lesson opens.
 *
 * Returns `{ url, loading, reason }`. A null url with a reason is a decision
 * the learner should be told about; a null url with reason 'unavailable' is a
 * fault and must not be presented as a payment problem.
 */
export function useLessonAsset(taskId) {
  const [state, setState] = useState({ url: null, loading: Boolean(taskId), reason: null });

  useEffect(() => {
    let cancelled = false;
    if (!taskId) {
      setState({ url: null, loading: false, reason: null });
      return undefined;
    }
    setState({ url: null, loading: true, reason: null });
    fetchLessonAsset(taskId).then((r) => {
      // The lesson can change while a request is in flight; a late answer for
      // the previous one must not overwrite the current lesson's media.
      if (!cancelled) setState({ url: r.url, loading: false, reason: r.reason });
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return state;
}
