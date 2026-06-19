/**
 * Register uploaded files in Firestore so super-admin can track and clean storage.
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

function ext(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function pathToDocId(path) {
  return path.replace(/\//g, '__');
}

function topFolder(path) {
  return (path || '').split('/')[0] || 'unknown';
}

function extractUserIdFromPath(path) {
  if (!path?.startsWith('mbw/')) return null;
  const parts = path.split('/');
  return parts.length >= 2 ? parts[1] : null;
}

export async function registerStorageObject({
  path,
  url,
  fileName,
  contentType,
  sizeBytes,
  uploadedBy,
  source,
  sourceId,
  sourceLabel,
}) {
  if (!db || !path) return;

  const folder = topFolder(path);
  const uid = uploadedBy || extractUserIdFromPath(path);

  await setDoc(
    doc(db, 'storage_objects', pathToDocId(path)),
    {
      path,
      url: url || '',
      fileName: fileName || path.split('/').pop(),
      contentType: contentType || '',
      sizeBytes: Number(sizeBytes) || 0,
      folder,
      uploadedBy: uid,
      source: source || folder,
      sourceId: sourceId || null,
      sourceLabel: sourceLabel || null,
      linked: Boolean(sourceId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadFile(file, folder, meta = {}) {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  if (!file) throw new Error('No file selected.');

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = `${folder}/${safeName}`;
  const fileRef = ref(storage, path);

  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  const result = { url, path, fileName: file.name, extension: ext(file.name) };

  try {
    await registerStorageObject({
      path,
      url,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedBy: meta.uploadedBy || null,
      source: meta.source || topFolder(path),
      sourceId: meta.sourceId || null,
      sourceLabel: meta.sourceLabel || null,
    });
  } catch (err) {
    console.warn('Storage registry write failed:', err);
  }

  return result;
}

export async function uploadResourceFile(file, meta = {}) {
  return uploadFile(file, 'resources', { source: 'resource', ...meta });
}

export async function uploadCourseAsset(file, meta = {}) {
  return uploadFile(file, 'courses', { source: 'course', ...meta });
}

export async function uploadEventImage(file, meta = {}) {
  return uploadFile(file, 'events', { source: 'event', ...meta });
}

export const ACCEPTED_RESOURCE_TYPES = {
  pdf: ['.pdf', 'application/pdf'],
  ppt: ['.ppt', '.pptx', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  video: [],
};

export function resourceTypeFromFile(file) {
  const e = ext(file.name);
  if (e === '.pdf') return 'pdf';
  if (e === '.ppt' || e === '.pptx') return 'ppt';
  return 'pdf';
}

export function formatStorageBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
