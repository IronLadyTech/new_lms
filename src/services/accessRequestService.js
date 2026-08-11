import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ACCESS_REQUESTS = 'access_requests';

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
