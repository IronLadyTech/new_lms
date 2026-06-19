/**
 * Firebase Storage admin — list, scan, delete, and orphan cleanup.
 * All operations require super-admin access.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const COLLECTION = 'storage_objects';
const BOOTSTRAP_EMAIL = 'ironladytech@gmail.com';

function pathToDocId(path) {
  return path.replace(/\//g, '__');
}

function topFolder(path) {
  return (path || '').split('/')[0] || 'unknown';
}

function extractPathFromFirebaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch (_) {
    /* ignore */
  }
  return null;
}

function extractUserIdFromPath(path) {
  if (!path || !path.startsWith('mbw/')) return null;
  const parts = path.split('/');
  return parts.length >= 2 ? parts[1] : null;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getBucket() {
  return admin.storage().bucket();
}

async function assertSuperAdmin(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (snap.data()?.role === 'superadmin') return;

  try {
    const userRecord = await admin.auth().getUser(uid);
    if (userRecord.email?.toLowerCase() === BOOTSTRAP_EMAIL) return;
  } catch (_) {
    /* ignore */
  }

  throw new HttpsError('permission-denied', 'Super admin access required');
}

/** Build a map of storage path → linked entity from Firestore documents. */
async function buildReferenceMap(db) {
  const byPath = new Map();
  const byUrl = new Map();

  function add(path, url, meta) {
    if (path) byPath.set(path, meta);
    if (url) byUrl.set(url, meta);
  }

  const [courses, resources, events, submissions] = await Promise.all([
    db.collection('courses').get(),
    db.collection('resources').get(),
    db.collection('events').get(),
    db.collection('mbw_submissions').get(),
  ]);

  for (const doc of courses.docs) {
    const d = doc.data();
    if (!d.thumbnail) continue;
    const path = extractPathFromFirebaseUrl(d.thumbnail);
    add(path, d.thumbnail, {
      source: 'course',
      sourceId: doc.id,
      sourceLabel: d.title || d.code || doc.id,
      uploadedBy: null,
    });
  }

  for (const doc of resources.docs) {
    const d = doc.data();
    if (!d.url) continue;
    const path = extractPathFromFirebaseUrl(d.url);
    add(path, d.url, {
      source: 'resource',
      sourceId: doc.id,
      sourceLabel: d.title || doc.id,
      uploadedBy: null,
    });
  }

  for (const doc of events.docs) {
    const d = doc.data();
    if (!d.imageUrl) continue;
    const path = extractPathFromFirebaseUrl(d.imageUrl);
    add(path, d.imageUrl, {
      source: 'event',
      sourceId: doc.id,
      sourceLabel: d.title || doc.id,
      uploadedBy: d.createdBy || null,
    });
  }

  for (const doc of submissions.docs) {
    const d = doc.data();
    const base = {
      source: 'mbw',
      sourceId: doc.id,
      sourceLabel: `MBW submission ${doc.id}`,
      uploadedBy: d.userId || null,
    };
    if (d.filePath) add(d.filePath, d.fileUrl, base);
    else if (d.fileUrl) {
      const path = extractPathFromFirebaseUrl(d.fileUrl);
      add(path, d.fileUrl, base);
    }
    if (d.videoUrl) {
      const path = extractPathFromFirebaseUrl(d.videoUrl);
      add(path, d.videoUrl, { ...base, sourceLabel: `MBW video ${doc.id}` });
    }
  }

  return { byPath, byUrl };
}

function resolveLink(path, url, refMap) {
  if (refMap.byPath.has(path)) return { linked: true, ...refMap.byPath.get(path) };
  if (url && refMap.byUrl.has(url)) return { linked: true, ...refMap.byUrl.get(url) };
  return {
    linked: false,
    source: 'orphan',
    sourceId: null,
    sourceLabel: null,
    uploadedBy: extractUserIdFromPath(path),
  };
}

async function unlinkFromSource(db, link) {
  if (!link?.linked || !link.sourceId) return;

  const { source, sourceId } = link;

  if (source === 'course') {
    await db.collection('courses').doc(sourceId).update({ thumbnail: '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } else if (source === 'resource') {
    await db.collection('resources').doc(sourceId).update({ url: '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } else if (source === 'event') {
    await db.collection('events').doc(sourceId).update({ imageUrl: '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } else if (source === 'mbw') {
    await db.collection('mbw_submissions').doc(sourceId).update({
      fileUrl: admin.firestore.FieldValue.delete(),
      fileName: admin.firestore.FieldValue.delete(),
      filePath: admin.firestore.FieldValue.delete(),
      videoUrl: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function deleteStoragePath(db, path, refMap, { unlink = true } = {}) {
  const bucket = getBucket();
  const docId = pathToDocId(path);
  const docSnap = await db.collection(COLLECTION).doc(docId).get();
  const stored = docSnap.exists ? docSnap.data() : null;

  let link = stored
    ? { linked: stored.linked, source: stored.source, sourceId: stored.sourceId, sourceLabel: stored.sourceLabel }
    : resolveLink(path, stored?.url, refMap);

  if (!link.linked && refMap) {
    link = resolveLink(path, stored?.url, refMap);
  }

  try {
    await bucket.file(path).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn(`Bucket delete failed for ${path}:`, err.message);
  }

  await db.collection(COLLECTION).doc(docId).delete().catch(() => {});

  if (unlink && link.linked) {
    await unlinkFromSource(db, link);
  }

  return { path, deleted: true, unlinked: unlink && link.linked };
}

async function getOverview(db) {
  const snap = await db.collection(COLLECTION).get();
  let totalBytes = 0;
  let totalFiles = 0;
  let orphanBytes = 0;
  let orphanCount = 0;
  const byFolder = {};
  const byUser = {};

  for (const doc of snap.docs) {
    const d = doc.data();
    const size = Number(d.sizeBytes) || 0;
    totalBytes += size;
    totalFiles += 1;

    const folder = d.folder || topFolder(d.path);
    byFolder[folder] = byFolder[folder] || { count: 0, bytes: 0 };
    byFolder[folder].count += 1;
    byFolder[folder].bytes += size;

    if (!d.linked || d.source === 'orphan') {
      orphanBytes += size;
      orphanCount += 1;
    }

    const uid = d.uploadedBy || extractUserIdFromPath(d.path);
    if (uid) {
      byUser[uid] = byUser[uid] || { count: 0, bytes: 0 };
      byUser[uid].count += 1;
      byUser[uid].bytes += size;
    }
  }

  return {
    totalBytes,
    totalFiles,
    orphanBytes,
    orphanCount,
    byFolder,
    byUser,
    totalBytesLabel: formatBytes(totalBytes),
    orphanBytesLabel: formatBytes(orphanBytes),
  };
}

async function scanBucket(db) {
  const bucket = getBucket();
  const refMap = await buildReferenceMap(db);
  const [files] = await bucket.getFiles();

  let scanned = 0;
  let linked = 0;
  let orphans = 0;
  const batchSize = 400;
  let batch = db.batch();
  let batchCount = 0;

  async function commitBatch() {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  for (const file of files) {
    const path = file.name;
    if (path.endsWith('/')) continue;

    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch (err) {
      console.warn(`Metadata read failed for ${path}:`, err.message);
      continue;
    }

    const url = metadata.mediaLink || null;
    const link = resolveLink(path, url, refMap);
    if (link.linked) linked += 1;
    else orphans += 1;

    const docRef = db.collection(COLLECTION).doc(pathToDocId(path));
    batch.set(
      docRef,
      {
        path,
        url,
        fileName: path.split('/').pop(),
        contentType: metadata.contentType || '',
        sizeBytes: Number(metadata.size) || 0,
        folder: topFolder(path),
        uploadedBy: link.uploadedBy || extractUserIdFromPath(path),
        source: link.source,
        sourceId: link.sourceId,
        sourceLabel: link.sourceLabel,
        linked: link.linked,
        scannedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    scanned += 1;
    batchCount += 1;
    if (batchCount >= batchSize) await commitBatch();
  }

  await commitBatch();

  return { scanned, linked, orphans, total: files.length };
}

async function listObjects(db, { folder, userId, source, linkedOnly, orphanOnly, limit = 100 } = {}) {
  let query = db.collection(COLLECTION);

  if (folder) query = query.where('folder', '==', folder);
  if (userId) query = query.where('uploadedBy', '==', userId);
  if (source) query = query.where('source', '==', source);
  if (linkedOnly) query = query.where('linked', '==', true);
  if (orphanOnly) query = query.where('linked', '==', false);

  const snap = await query.limit(Math.min(limit, 500)).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (Number(b.sizeBytes) || 0) - (Number(a.sizeBytes) || 0));
  return items;
}

async function cleanOrphans(db) {
  const refMap = await buildReferenceMap(db);
  const snap = await db.collection(COLLECTION).where('linked', '==', false).get();

  let deleted = 0;
  let freedBytes = 0;
  const errors = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const path = d.path;
    if (!path) continue;

    const link = resolveLink(path, d.url, refMap);
    if (link.linked) {
      await doc.ref.update({ linked: true, source: link.source, sourceId: link.sourceId, sourceLabel: link.sourceLabel });
      continue;
    }

    try {
      await deleteStoragePath(db, path, refMap, { unlink: false });
      deleted += 1;
      freedBytes += Number(d.sizeBytes) || 0;
    } catch (err) {
      if (errors.length < 10) errors.push(`${path}: ${err.message}`);
    }
  }

  return { deleted, freedBytes, freedBytesLabel: formatBytes(freedBytes), errors };
}

async function deleteUserStorage(db, userId) {
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required');

  const bucket = getBucket();
  const prefix = `mbw/${userId}/`;
  const refMap = await buildReferenceMap(db);

  let deleted = 0;
  let freedBytes = 0;

  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) {
    const path = file.name;
    let size = 0;
    try {
      const [meta] = await file.getMetadata();
      size = Number(meta.size) || 0;
    } catch (_) {
      /* ignore */
    }
    await deleteStoragePath(db, path, refMap, { unlink: true });
    deleted += 1;
    freedBytes += size;
  }

  const subsSnap = await db.collection('mbw_submissions').where('userId', '==', userId).get();
  const batch = db.batch();
  for (const doc of subsSnap.docs) {
    batch.update(doc.ref, {
      fileUrl: admin.firestore.FieldValue.delete(),
      fileName: admin.firestore.FieldValue.delete(),
      filePath: admin.firestore.FieldValue.delete(),
      videoUrl: admin.firestore.FieldValue.delete(),
      storageSkipped: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if (!subsSnap.empty) await batch.commit();

  const registrySnap = await db.collection(COLLECTION).where('uploadedBy', '==', userId).get();
  const regBatch = db.batch();
  for (const doc of registrySnap.docs) {
    regBatch.delete(doc.ref);
  }
  if (!registrySnap.empty) await regBatch.commit();

  return { deleted, freedBytes, freedBytesLabel: formatBytes(freedBytes), userId };
}

async function resetUserStorage(db, userId) {
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required');
  return deleteUserStorage(db, userId);
}

async function deleteObjects(db, paths = []) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new HttpsError('invalid-argument', 'paths array is required');
  }

  const refMap = await buildReferenceMap(db);
  const results = [];

  for (const path of paths.slice(0, 50)) {
    try {
      const result = await deleteStoragePath(db, path, refMap, { unlink: true });
      results.push(result);
    } catch (err) {
      results.push({ path, deleted: false, error: err.message });
    }
  }

  return { results, deleted: results.filter((r) => r.deleted).length };
}

module.exports = {
  assertSuperAdmin,
  pathToDocId,
  formatBytes,
  getOverview,
  scanBucket,
  listObjects,
  cleanOrphans,
  deleteUserStorage,
  resetUserStorage,
  deleteObjects,
  deleteStoragePath,
};
