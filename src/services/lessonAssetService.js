import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

/**
 * Ask the server for a lesson's media URL.
 *
 * The URLs are deliberately not in this bundle. They used to be, and anyone who
 * signed up could read them out of the page and watch paid content without
 * paying — a padlock on screen cannot prevent that, because whatever the
 * browser receives the person holding it can read.
 *
 * Denials come back as a reason rather than an error string so the caller can
 * say something true: needing to pay and having run out of time are different
 * situations and a learner can act on the difference.
 */
export async function fetchLessonAsset(taskId) {
  if (!functions || !taskId) return { url: null, reason: 'unavailable' };

  try {
    const { data } = await httpsCallable(functions, 'getLessonAsset')({ taskId });
    return { url: data?.url || null, reason: null };
  } catch (err) {
    // permission-denied carries the reason the gate gave; anything else is a
    // fault rather than a decision, and must not read as "you have not paid".
    const reason = err?.code === 'functions/permission-denied' ? err.message : 'unavailable';
    return { url: null, reason };
  }
}
