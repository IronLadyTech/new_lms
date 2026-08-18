/**
 * Lesson media, kept on the server.
 *
 * These URLs used to sit in the client catalogue, which every visitor's browser
 * downloads — so a learner who had paid nothing could read them out of the
 * bundle and watch paid content. Unlisted YouTube links are not a control:
 * unlisted only keeps a video out of search, and anyone holding the link can
 * watch with no account at all.
 *
 * Nothing here ever reaches a client that has not been checked. The callable in
 * index.js is the only way out, and it asks paidContentDecision first.
 *
 * Adding a lesson: put it here, not in mbwService.js or bm100 task data. If a
 * URL appears in src/ again it is public, whatever the UI shows.
 */

const { paidContentDecision } = require('./accessTiers');

/**
 * taskId → { program, requiresPaid, url }
 *
 * `requiresPaid` is per lesson rather than per section, because a free taster
 * inside a paid phase is a normal thing to want and the section gate cannot
 * express it.
 */
const LESSON_ASSETS = {
  // MBW — Pre-Preparation. Free tier: part of the onboarding sequence.
  'mbw-pre-2': {
    program: 'mbw',
    requiresPaid: false,
    url: 'https://www.youtube.com/watch?v=uo9xA5xiRWY',
  },
};

/** Firestore collection holding per-batch overrides. Staff write, learners never read. */
const LESSON_MEDIA = 'lesson_media';

/** One document per lesson: `<program>__<taskId>`. */
function lessonMediaDocId(program, taskId) {
  return `${program}__${taskId}`;
}

/** Registered lesson ids, for diagnostics. Never the URLs. */
function knownAssetIds() {
  return Object.keys(LESSON_ASSETS);
}

/**
 * Resolve a lesson's media for a given learner.
 *
 * Returns a discriminated result rather than throwing, so the caller decides
 * the transport-level response and the learner gets a reason they can act on.
 */
/**
 * Which URL this learner should get for this lesson.
 *
 * Two or three videos per programme are the same for everyone and live in the
 * code map. The rest are recorded per batch and uploaded by the team, so the
 * same lesson id has a different video depending on which cohort the learner
 * is in. A batch entry always wins over the permanent one; without a batch
 * entry the permanent link is the fallback, which is what makes a half-filled
 * programme work rather than breaking every lesson that has not been uploaded
 * yet.
 *
 * `media` is the stored document for this lesson, or null when none exists.
 */
function pickUrl(asset, media, batchName) {
  const batch = String(batchName || '').trim();
  const byBatch = media?.byBatch || {};
  if (batch && byBatch[batch]) return { url: byBatch[batch], source: 'batch' };
  if (media?.defaultUrl) return { url: media.defaultUrl, source: 'default-stored' };
  if (asset?.url) return { url: asset.url, source: 'permanent' };
  return { url: null, source: null };
}

/**
 * Resolve a lesson's media for a given learner.
 *
 * Returns a discriminated result rather than throwing, so the caller decides
 * the transport-level response and the learner gets a reason they can act on.
 */
function resolveLessonAsset(profile, taskId, now = new Date(), media = null) {
  const id = String(taskId || '').trim();
  if (!id) return { ok: false, reason: 'missing-task-id' };

  const asset = LESSON_ASSETS[id] || null;
  const program = asset?.program || media?.program || null;
  // Deliberately the same answer as an unentitled lookup would give for a real
  // lesson: probing ids should not reveal which ones exist.
  if (!program) return { ok: false, reason: 'not-found' };

  // A stored document may raise the requirement for a lesson the code map
  // treats as free, but must not lower one it treats as paid.
  const requiresPaid = Boolean(asset?.requiresPaid) || Boolean(media?.requiresPaid);

  if (requiresPaid) {
    const decision = paidContentDecision(profile, program, now);
    if (!decision.allowed) {
      return { ok: false, reason: decision.reason, program };
    }
  }

  const { url, source } = pickUrl(asset, media, profile?.batchName);
  if (!url) {
    // Entitled, but the team has not uploaded this batch's recording yet. A
    // distinct reason so the learner is told to wait rather than to pay.
    return { ok: false, reason: 'not-uploaded', program };
  }

  return { ok: true, url, program, gated: requiresPaid, source };
}

module.exports = {
  LESSON_ASSETS,
  LESSON_MEDIA,
  lessonMediaDocId,
  knownAssetIds,
  pickUrl,
  resolveLessonAsset,
};
