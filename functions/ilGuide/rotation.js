/** Firestore-backed last-whisper tracking (no Redis required). */

const COLLECTION = 'ilguide_rotation';

function docId(participantId, surface) {
  return `${participantId}_${surface}`;
}

async function getLastMessageId(db, participantId, surface) {
  const snap = await db.collection(COLLECTION).doc(docId(participantId, surface)).get();
  return snap.exists ? snap.data()?.lastMessageId || null : null;
}

async function setLastMessageId(db, participantId, surface, messageId) {
  await db.collection(COLLECTION).doc(docId(participantId, surface)).set(
    {
      lastMessageId: messageId,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

module.exports = { getLastMessageId, setLastMessageId };
