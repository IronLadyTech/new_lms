import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const EVENTS = 'events';

function sortEventsByDateTime(events) {
  return [...events].sort((a, b) => {
    const da = a.date || '';
    const db_ = b.date || '';
    if (da !== db_) return da.localeCompare(db_);
    return (a.time || '').localeCompare(b.time || '');
  });
}

function dateOffsetIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeEventPayload(data = {}) {
  const batchId = data.batchId ? String(data.batchId) : '';
  const audience = batchId ? 'batch' : data.audience === 'batch' ? 'batch' : 'all';
  return {
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || '',
    endTime: data.endTime || '',
    type: data.type || 'general',
    imageUrl: data.imageUrl || '',
    linkUrl: data.linkUrl || '',
    batchId: batchId || null,
    batchName: data.batchName || '',
    audience,
    /** When true, session is meant to reserve staff calendars for this batch. */
    blocksStaff: Boolean(data.blocksStaff ?? Boolean(batchId)),
  };
}

export async function getEvents() {
  const snap = await getDocs(collection(db, EVENTS));
  return sortEventsByDateTime(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export async function getEventsForBatch(batchId) {
  if (!batchId) return [];
  try {
    const q = query(collection(db, EVENTS), where('batchId', '==', batchId));
    const snap = await getDocs(q);
    return sortEventsByDateTime(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    const all = await getEvents();
    return all.filter((ev) => ev.batchId === batchId);
  }
}

/**
 * Bounded event fetch for notification bell / home widgets.
 * Avoids loading the entire events collection on every poll.
 */
export async function getRecentEventsForNotifications({
  daysBack = 14,
  daysAhead = 90,
  limitCount = 40,
} = {}) {
  const startDate = dateOffsetIso(-daysBack);
  const endDate = dateOffsetIso(daysAhead);

  try {
    const q = query(
      collection(db, EVENTS),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return sortEventsByDateTime(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    const message = String(e?.message || '');
    if (!message.includes('index')) throw e;
    const snap = await getDocs(query(collection(db, EVENTS), limit(limitCount)));
    return sortEventsByDateTime(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
}

export async function createEvent(data) {
  const ref = doc(collection(db, EVENTS));
  const normalized = normalizeEventPayload(data);
  const event = {
    ...normalized,
    createdBy: data.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, event);
  return { id: ref.id, ...event };
}

export async function updateEvent(eventId, data) {
  const patch = { updatedAt: serverTimestamp() };
  const allowed = [
    'title',
    'description',
    'date',
    'time',
    'endTime',
    'type',
    'imageUrl',
    'linkUrl',
    'batchId',
    'batchName',
    'audience',
    'blocksStaff',
  ];
  allowed.forEach((key) => {
    if (data[key] !== undefined) patch[key] = data[key];
  });
  if (patch.batchId !== undefined) {
    const batchId = patch.batchId ? String(patch.batchId) : '';
    patch.batchId = batchId || null;
    patch.audience = batchId ? 'batch' : patch.audience === 'batch' ? 'batch' : 'all';
    if (patch.blocksStaff === undefined) patch.blocksStaff = Boolean(batchId);
  }
  await updateDoc(doc(db, EVENTS, eventId), patch);
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
