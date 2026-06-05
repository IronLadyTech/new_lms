import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { logUserActivity } from './userService';

const TICKETS = 'tickets';

export const TICKET_CATEGORIES = [
  { value: 'course', label: 'Course issue' },
  { value: 'login', label: 'Login issue' },
  { value: 'payment', label: 'Payment issue' },
  { value: 'other', label: 'Other' },
];

export const TICKET_STATUSES = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  RESOLVED: 'resolved',
};

export function categoryLabel(value) {
  return TICKET_CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function statusLabel(status) {
  if (status === TICKET_STATUSES.RESOLVED) return 'Resolved';
  if (status === TICKET_STATUSES.ASSIGNED) return 'Assigned';
  return 'Open';
}

export async function createTicket({ userId, userEmail, userDisplayName, category, subject, message }) {
  const ref = doc(collection(db, TICKETS));
  const ticket = {
    userId,
    userEmail: userEmail || '',
    userDisplayName: userDisplayName || 'User',
    category,
    subject,
    status: TICKET_STATUSES.OPEN,
    assignedTo: null,
    assignedToName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  };
  await setDoc(ref, ticket);

  logUserActivity(userId, {
    type: 'ticket_created',
    title: subject,
    metadata: { ticketId: ref.id, category },
  }).catch(() => {});

  if (message?.trim()) {
    await addTicketMessage(ref.id, {
      senderId: userId,
      senderName: userDisplayName || userEmail?.split('@')[0] || 'User',
      senderRole: 'user',
      text: message.trim(),
    });
  }

  return { id: ref.id, ...ticket };
}

export async function getUserTickets(userId) {
  const q = query(collection(db, TICKETS), where('userId', '==', userId));
  const snap = await getDocs(q);
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  tickets.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return tickets;
}

export async function getAllTickets() {
  const snap = await getDocs(collection(db, TICKETS));
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  tickets.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return tickets;
}

export async function getTicket(ticketId) {
  const snap = await getDoc(doc(db, TICKETS, ticketId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function assignTicket(ticketId, { assignedTo, assignedToName }) {
  await updateDoc(doc(db, TICKETS, ticketId), {
    assignedTo,
    assignedToName: assignedToName || null,
    status: TICKET_STATUSES.ASSIGNED,
    updatedAt: serverTimestamp(),
  });
}

export async function resolveTicket(ticketId) {
  await updateDoc(doc(db, TICKETS, ticketId), {
    status: TICKET_STATUSES.RESOLVED,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTicket(ticketId, { subject, category }) {
  const data = { updatedAt: serverTimestamp() };
  if (subject !== undefined) data.subject = subject;
  if (category !== undefined) data.category = category;
  await updateDoc(doc(db, TICKETS, ticketId), data);
}

export async function deleteTicket(ticketId) {
  const msgs = await getDocs(collection(db, TICKETS, ticketId, 'messages'));
  const batch = writeBatch(db);
  msgs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, TICKETS, ticketId));
  await batch.commit();
}

export async function reopenTicket(ticketId) {
  await updateDoc(doc(db, TICKETS, ticketId), {
    status: TICKET_STATUSES.OPEN,
    resolvedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function addTicketMessage(ticketId, { senderId, senderName, senderRole, text }) {
  const ref = doc(collection(db, TICKETS, ticketId, 'messages'));
  const msg = {
    senderId,
    senderName: senderName || 'User',
    senderRole: senderRole || 'user',
    text,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, msg);
  await updateDoc(doc(db, TICKETS, ticketId), { updatedAt: serverTimestamp() });

  if ((senderRole || 'user') === 'user') {
    logUserActivity(senderId, {
      type: 'ticket_reply',
      title: text.slice(0, 80),
      metadata: { ticketId },
    }).catch(() => {});
  }

  return { id: ref.id, ...msg };
}

export async function getTicketMessages(ticketId) {
  const snap = await getDocs(collection(db, TICKETS, ticketId, 'messages'));
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  messages.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  return messages;
}

export async function replyToTicket(ticketId, { senderId, senderName, senderRole, text }) {
  await addTicketMessage(ticketId, { senderId, senderName, senderRole, text });
}
