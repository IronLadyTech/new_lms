import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const EVENTS = 'events';

export async function getEvents() {
  const snap = await getDocs(collection(db, EVENTS));
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  events.sort((a, b) => {
    const da = a.date || '';
    const db_ = b.date || '';
    if (da !== db_) return da.localeCompare(db_);
    return (a.time || '').localeCompare(b.time || '');
  });
  return events;
}

export async function createEvent(data) {
  const ref = doc(collection(db, EVENTS));
  const event = {
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || '',
    type: data.type || 'general',
    imageUrl: data.imageUrl || '',
    linkUrl: data.linkUrl || '',
    createdBy: data.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, event);
  return { id: ref.id, ...event };
}

export async function updateEvent(eventId, data) {
  await updateDoc(doc(db, EVENTS, eventId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, EVENTS, eventId));
}

export function eventsForDate(events, dateStr) {
  return events.filter((e) => e.date === dateStr);
}

export function eventsForMonth(events, year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return events.filter((e) => e.date?.startsWith(prefix));
}
