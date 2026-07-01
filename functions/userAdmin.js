/**
 * Super-admin user deletion — Firebase Auth + Firestore learner data.
 */

const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const storageAdmin = require('./storage');

const SUPER_ADMIN_EMAIL = 'ironladytech@gmail.com';
const STAFF_ROLES = new Set(['admin', 'moderator', 'superadmin']);

async function deleteQueryBatch(query, batchSize = 400) {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return 0;

  const batch = admin.firestore().batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  return snap.size;
}

async function deleteCollectionWhere(db, collectionName, field, value) {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const count = await deleteQueryBatch(
      db.collection(collectionName).where(field, '==', value)
    );
    total += count;
    if (count < 400) break;
  }
  return total;
}

async function deleteUserTickets(db, userId) {
  const snap = await db.collection('tickets').where('userId', '==', userId).get();
  let tickets = 0;
  let messages = 0;

  for (const ticketDoc of snap.docs) {
    const msgSnap = await ticketDoc.ref.collection('messages').get();
    if (!msgSnap.empty) {
      const batch = db.batch();
      msgSnap.docs.forEach((msgDoc) => batch.delete(msgDoc.ref));
      await batch.commit();
      messages += msgSnap.size;
    }
    await ticketDoc.ref.delete();
    tickets += 1;
  }

  return { tickets, messages };
}

async function removeUserFromGroups(db, userId) {
  const snap = await db.collection('groups').get();
  let updated = 0;

  for (const groupDoc of snap.docs) {
    const data = groupDoc.data() || {};
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
    const moderatorIds = Array.isArray(data.moderatorIds) ? data.moderatorIds : [];
    const inMembers = memberIds.includes(userId);
    const inMods = moderatorIds.includes(userId);
    if (!inMembers && !inMods) continue;

    const next = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (inMembers) {
      next.memberIds = memberIds.filter((id) => id !== userId);
    }
    if (inMods) {
      next.moderatorIds = moderatorIds.filter((id) => id !== userId);
    }
    await groupDoc.ref.update(next);
    updated += 1;
  }

  return updated;
}

function canDeleteTarget(callerUid, callerEmail, targetUid, targetProfile) {
  if (!targetUid) return { ok: false, reason: 'userId is required' };
  if (targetUid === callerUid) {
    return { ok: false, reason: 'You cannot delete your own account from admin' };
  }

  const targetEmail = (targetProfile?.email || '').toLowerCase().trim();
  if (targetEmail === SUPER_ADMIN_EMAIL) {
    return { ok: false, reason: 'The bootstrap super-admin account cannot be deleted' };
  }

  const role = targetProfile?.role || 'student';
  if (STAFF_ROLES.has(role)) {
    return { ok: false, reason: 'Staff accounts cannot be deleted here — demote to student first or contact support' };
  }

  return { ok: true };
}

async function deleteUserAccount(db, { callerUid, userId }) {
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required');

  await storageAdmin.assertSuperAdmin(db, callerUid);

  const callerSnap = await db.collection('users').doc(callerUid).get();
  const callerEmail = callerSnap.data()?.email || '';

  const profileSnap = await db.collection('users').doc(userId).get();
  if (!profileSnap.exists) {
    throw new HttpsError('not-found', 'User profile not found');
  }

  const targetProfile = profileSnap.data();
  const gate = canDeleteTarget(callerUid, callerEmail, userId, targetProfile);
  if (!gate.ok) {
    throw new HttpsError('failed-precondition', gate.reason);
  }

  const summary = {
    userId,
    email: targetProfile.email || null,
    mbwSubmissions: 0,
    activities: 0,
    learnerSubmissions: 0,
    attendance: 0,
    tickets: 0,
    groupsUpdated: 0,
    storageFiles: 0,
    authDeleted: false,
    profileDeleted: false,
  };

  try {
    const storageResult = await storageAdmin.deleteUserStorage(db, userId);
    summary.storageFiles = storageResult.deleted || 0;
  } catch (err) {
    console.warn(`Storage cleanup for ${userId}:`, err.message);
    summary.storageError = err.message;
  }

  summary.mbwSubmissions = await deleteCollectionWhere(db, 'mbw_submissions', 'userId', userId);
  summary.activities = await deleteCollectionWhere(db, 'activities', 'userId', userId);
  summary.learnerSubmissions = await deleteCollectionWhere(db, 'learner_submissions', 'learnerId', userId);
  summary.attendance = await deleteCollectionWhere(db, 'attendance', 'learnerId', userId);
  const ticketResult = await deleteUserTickets(db, userId);
  summary.tickets = ticketResult.tickets;
  summary.ticketMessages = ticketResult.messages;
  summary.groupsUpdated = await removeUserFromGroups(db, userId);

  await db.collection('users').doc(userId).delete();
  summary.profileDeleted = true;

  try {
    await admin.auth().deleteUser(userId);
    summary.authDeleted = true;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      summary.authDeleted = false;
      summary.authNote = 'No Firebase Auth user (profile and data were removed)';
    } else {
      throw err;
    }
  }

  return { ok: true, ...summary };
}

module.exports = { deleteUserAccount, canDeleteTarget };
