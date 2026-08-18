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
function resolveLessonAsset(profile, taskId, now = new Date()) {
  const id = String(taskId || '').trim();
  if (!id) return { ok: false, reason: 'missing-task-id' };

  const asset = LESSON_ASSETS[id];
  // Deliberately the same answer as an unentitled lookup would give for a real
  // lesson: probing ids should not reveal which ones exist.
  if (!asset) return { ok: false, reason: 'not-found' };

  if (!asset.requiresPaid) {
    return { ok: true, url: asset.url, program: asset.program, gated: false };
  }

  const decision = paidContentDecision(profile, asset.program, now);
  if (!decision.allowed) {
    return { ok: false, reason: decision.reason, program: asset.program };
  }

  return { ok: true, url: asset.url, program: asset.program, gated: true };
}

module.exports = {
  LESSON_ASSETS,
  knownAssetIds,
  resolveLessonAsset,
};
