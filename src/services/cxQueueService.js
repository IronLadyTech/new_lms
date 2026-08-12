import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Review-queue reads that do not grow with the size of the cohort.
 *
 * The CX screens used to download every submission in the programme and work
 * the totals out in the browser. Measured at 1,000 learners that was ~9,000
 * records and a 40-80 second wait, of which the browser's own share was under
 * 15ms — it was all fetching. These queries ask the database for a count and a
 * page instead, so a screen costs the same whether the cohort is 50 or 5,000.
 *
 * Ordering is on `updatedAt`, which every write path sets. `submittedAt` would
 * read better but is only written on some paths, and Firestore silently omits
 * documents that lack the field being ordered on — which would have hidden real
 * pending reviews rather than merely misordering them.
 */

/** Statuses CX can see at all. Locked/unlocked work has not been handed over. */
export const CX_VISIBLE_STATUSES = [
  'submitted',
  'under_review',
  'completed',
  'needs_improvement',
  'rejected',
];

/** Waiting on a reviewer. */
export const CX_PENDING_STATUSES = ['submitted', 'under_review'];

/** Handed back; waiting on the learner. */
export const CX_ACTION_STATUSES = ['needs_improvement', 'rejected'];

/** Everything that belongs in a working queue — pending plus handed back. */
export const CX_QUEUE_STATUSES = [...CX_ACTION_STATUSES, ...CX_PENDING_STATUSES];

/**
 * Firestore allows one `in` per query, so a status list and a batch list cannot
 * both be ranges. Batch is therefore matched with `==`, which is what the UI
 * offers anyway: one batch at a time, or all of them.
 */
function buildConstraints({ statuses, batchId }) {
  const constraints = [];
  if (batchId && batchId !== 'all') constraints.push(where('batchId', '==', batchId));
  if (statuses?.length) constraints.push(where('status', 'in', statuses));
  return constraints;
}

/**
 * How many submissions match, without reading them.
 *
 * Returns null when the count cannot be obtained, so callers can tell "none"
 * from "not known" and avoid displaying a confident zero.
 */
export async function countSubmissions(collectionName, { statuses, batchId } = {}) {
  if (!db) return null;
  try {
    const snap = await getCountFromServer(
      query(collection(db, collectionName), ...buildConstraints({ statuses, batchId }))
    );
    return snap.data().count;
  } catch (err) {
    console.warn('CX count failed', err?.code || err);
    return null;
  }
}

/**
 * One page of the queue, newest activity first.
 *
 * `cursor` is the last document from the previous page; pass it back to
 * continue. Returns the raw documents plus the cursor for the next call.
 */
export async function getSubmissionsPage(
  collectionName,
  { statuses, batchId, pageSize = 50, cursor = null } = {}
) {
  if (!db) return { rows: [], cursor: null, done: true };

  const constraints = [
    ...buildConstraints({ statuses, batchId }),
    orderBy('updatedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];

  const snap = await getDocs(query(collection(db, collectionName), ...constraints));
  return {
    rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    done: snap.docs.length < pageSize,
  };
}

/** A single submission, for screens that deep-link into one. */
export async function getSubmissionById(collectionName, id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
