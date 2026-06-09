import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ANNOUNCEMENTS = 'announcements';

export const ANNOUNCEMENT_DURATIONS = [
  { value: '24h', label: '24 hours', hours: 24 },
  { value: '7d', label: '7 days', hours: 168 },
  { value: '30d', label: '30 days', hours: 720 },
];

export const ANNOUNCEMENT_AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'tagged', label: 'Tagged users only' },
];

function durationHours(value) {
  return ANNOUNCEMENT_DURATIONS.find((d) => d.value === value)?.hours || 24;
}

export function computeExpiresAt(duration, fromDate = new Date()) {
  const ms = fromDate.getTime() + durationHours(duration) * 60 * 60 * 1000;
  return Timestamp.fromDate(new Date(ms));
}

export function getExpiresAtMillis(announcement) {
  const ts = announcement?.expiresAt;
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function isAnnouncementActive(announcement, now = Date.now()) {
  const expires = getExpiresAtMillis(announcement);
  if (expires == null) return true;
  return expires > now;
}

export function isAnnouncementVisibleToUser(announcement, userId) {
  if (!userId || !isAnnouncementActive(announcement)) return false;
  const audience = announcement.audience || 'all';
  const tagged = announcement.taggedUserIds || [];
  if (audience === 'tagged') return tagged.includes(userId);
  return true;
}

export function durationLabel(value) {
  return ANNOUNCEMENT_DURATIONS.find((d) => d.value === value)?.label || value;
}

export function formatExpiresIn(announcement) {
  const expires = getExpiresAtMillis(announcement);
  if (expires == null) return '';
  const diff = expires - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours || 1}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
}

export async function getAnnouncements() {
  const snap = await getDocs(collection(db, ANNOUNCEMENTS));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
  return items;
}

export async function createAnnouncement(data) {
  const duration = data.duration || '24h';
  const ref = doc(collection(db, ANNOUNCEMENTS));
  const announcement = {
    title: data.title?.trim() || 'Announcement',
    body: data.body?.trim() || '',
    duration,
    audience: data.audience === 'tagged' ? 'tagged' : 'all',
    taggedUserIds: Array.isArray(data.taggedUserIds) ? data.taggedUserIds : [],
    taggedUserNames: Array.isArray(data.taggedUserNames) ? data.taggedUserNames : [],
    expiresAt: computeExpiresAt(duration),
    createdBy: data.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, announcement);
  return { id: ref.id, ...announcement };
}

export async function updateAnnouncement(announcementId, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (data.duration) {
    payload.expiresAt = computeExpiresAt(data.duration);
  }
  if (data.taggedUserIds) {
    payload.taggedUserIds = data.taggedUserIds;
  }
  if (data.taggedUserNames) {
    payload.taggedUserNames = data.taggedUserNames;
  }
  if (data.audience) {
    payload.audience = data.audience === 'tagged' ? 'tagged' : 'all';
  }
  await updateDoc(doc(db, ANNOUNCEMENTS, announcementId), payload);
}

export async function deleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, ANNOUNCEMENTS, announcementId));
}

export function getActiveAnnouncementsForUser(announcements, userId) {
  return announcements.filter((a) => isAnnouncementVisibleToUser(a, userId));
}
