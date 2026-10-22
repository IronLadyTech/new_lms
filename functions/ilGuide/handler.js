const { HttpsError } = require('firebase-functions/v2/https');
const { generateWhisper } = require('./generator');
const { isBlockedRole } = require('./fallback');

async function handleWhisper(request, db, openAiKey, openAiModel) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const context = request.data?.context;
  if (!context || typeof context !== 'object') {
    throw new HttpsError('invalid-argument', 'context is required');
  }

  if (context.participantId && context.participantId !== uid) {
    throw new HttpsError('permission-denied', 'Participant mismatch');
  }

  const profileSnap = await db.collection('users').doc(uid).get();
  const profile = profileSnap.data() || {};
  if (isBlockedRole(profile.role)) {
    throw new HttpsError('permission-denied', 'IL Guide is for enrolled learners only');
  }

  const normalized = {
    ...context,
    participantId: uid,
  };

  return generateWhisper(db, openAiKey, openAiModel, normalized);
}

module.exports = { handleWhisper };
