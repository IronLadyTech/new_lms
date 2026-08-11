import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  limit,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ACCESS_REQUESTS = 'access_requests';

export const ACCESS_REQUEST_STATUSES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  CLOSED: 'closed',
};

export const ACCESS_REQUEST_FILTERS = [
  { id: 'all', label: 'All' },
  { id: ACCESS_REQUEST_STATUSES.NEW, label: 'New' },
  { id: ACCESS_REQUEST_STATUSES.CONTACTED, label: 'Contacted' },
  { id: ACCESS_REQUEST_STATUSES.CLOSED, label: 'Closed' },
];

export function accessRequestStatusLabel(status) {
  if (status === ACCESS_REQUEST_STATUSES.CONTACTED) return 'Contacted';
  if (status === ACCESS_REQUEST_STATUSES.CLOSED) return 'Closed';
  return 'New';
}

/** Mirrors the length caps in firestore.rules — keep the two in sync. */
export const ACCESS_REQUEST_LIMITS = {
  name: 120,
  email: 200,
  message: 2000,
};

/**
 * Capture a guest's programme enquiry server-side.
 *
 * Written before any mailto hand-off so the lead is never lost when the visitor
 * has no mail client configured, or abandons the draft.
 */
export async function createAccessRequest({ name, email, program, message }) {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim();

  if (!trimmedName) throw new Error('Enter your name.');
  if (!trimmedEmail) throw new Error('Enter your email address.');

  const ref = await addDoc(collection(db, ACCESS_REQUESTS), {
    name: trimmedName.slice(0, ACCESS_REQUEST_LIMITS.name),
    email: trimmedEmail.slice(0, ACCESS_REQUEST_LIMITS.email),
    program: String(program || '').slice(0, 40),
    message: String(message || '')
      .trim()
      .slice(0, ACCESS_REQUEST_LIMITS.message),
    status: 'new',
    source: 'lms_guest',
    createdAt: serverTimestamp(),
  });

  return { id: ref.id };
}

/** Staff-only: newest enquiries first. */
export async function getAccessRequests(limitCount = 100) {
  const snap = await getDocs(
    query(collection(db, ACCESS_REQUESTS), orderBy('createdAt', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Staff-only: move an enquiry through new -> contacted -> closed. */
export async function setAccessRequestStatus(id, status) {
  await updateDoc(doc(db, ACCESS_REQUESTS, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Staff-only. */
export async function deleteAccessRequest(id) {
  await deleteDoc(doc(db, ACCESS_REQUESTS, id));
}
