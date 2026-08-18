import { describe, it, expect } from 'vitest';
import lessonAssets from './lessonAssets.js';
import accessTiers from './accessTiers.js';

const { resolveLessonAsset, LESSON_ASSETS, knownAssetIds } = lessonAssets;
const { paidContentDecision } = accessTiers;

/**
 * The asset gate.
 *
 * Lesson URLs used to live in the client catalogue, which every browser
 * downloads, so a learner who had paid nothing could read them out of the page
 * and watch paid content. Unlisted YouTube is not a control — it keeps a video
 * out of search and nothing more.
 *
 * This is the only route to a URL now, so these cases are the whole boundary.
 * A learner is entitled when three things hold at once: they are enrolled in
 * the programme, they have paid for it in full, and the access window is still
 * open. Any one of them failing must withhold the URL.
 */

const PAID_ASSET_ID = 'mbw-paid-fixture';
const FIXTURE = { program: 'mbw', requiresPaid: true, url: 'https://example.test/paid.mp4' };

/** Registered for the duration of the file so the real catalogue stays honest. */
LESSON_ASSETS[PAID_ASSET_ID] = FIXTURE;

const learner = ({ tier = 'paid', programme = 'mbw', paidAt = null } = {}) => ({
  program: programme,
  programs: [programme],
  programAccess: { [programme]: { paymentStatus: tier, ...(paidAt ? { fullPaidAt: paidAt } : {}) } },
});

describe('asset gate · who gets a URL', () => {
  it('gives a fully paid, enrolled learner the URL', () => {
    const r = resolveLessonAsset(learner(), PAID_ASSET_ID);
    expect(r.ok).toBe(true);
    expect(r.url).toBe(FIXTURE.url);
  });

  it('withholds it from a registration-tier learner', () => {
    const r = resolveLessonAsset(learner({ tier: 'register' }), PAID_ASSET_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('payment-required');
    expect(r.url).toBeUndefined();
  });

  // null rather than undefined: an undefined argument would fall back to the
  // helper's own default and quietly test the paid case instead.
  it.each(['unpaid', 'failed', 'refunded', 'completed', 'awaiting_settlement', null])(
    'withholds it at tier %s',
    (tier) => {
      const r = resolveLessonAsset(learner({ tier }), PAID_ASSET_ID);
      expect(r.ok).toBe(false);
      expect(r.url).toBeUndefined();
    }
  );

  it('withholds it from someone enrolled in a different programme', () => {
    // Paying for 100BM must not buy MBW media.
    const r = resolveLessonAsset(learner({ programme: '100bm' }), PAID_ASSET_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-enrolled');
  });

  it('withholds it once the access window has closed', () => {
    const expired = learner({ paidAt: '2024-01-01T00:00:00.000Z' }); // MBW window is 24 months
    const r = resolveLessonAsset(expired, PAID_ASSET_ID, new Date('2026-08-18T00:00:00.000Z'));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('access-expired');
  });

  it('still gives it while the window is open', () => {
    const recent = learner({ paidAt: '2026-01-01T00:00:00.000Z' });
    const r = resolveLessonAsset(recent, PAID_ASSET_ID, new Date('2026-08-18T00:00:00.000Z'));
    expect(r.ok).toBe(true);
  });

  it('withholds it from an empty or missing profile', () => {
    for (const p of [null, undefined, {}]) {
      expect(resolveLessonAsset(p, PAID_ASSET_ID).ok).toBe(false);
    }
  });
});

describe('asset gate · free lessons', () => {
  it('serves a free lesson to anyone signed in', () => {
    const freeId = knownAssetIds().find((id) => LESSON_ASSETS[id].requiresPaid === false);
    expect(freeId).toBeTruthy();
    const r = resolveLessonAsset({}, freeId);
    expect(r.ok).toBe(true);
    expect(r.gated).toBe(false);
  });
});

describe('asset gate · probing and malformed input', () => {
  it('does not reveal which lesson ids exist', () => {
    // An unknown id and an unentitled real id must be distinguishable only by
    // the reason the caller is allowed to see, never by whether media exists.
    expect(resolveLessonAsset(learner(), 'no-such-lesson').reason).toBe('not-found');
    expect(resolveLessonAsset(learner(), '../../etc/passwd').reason).toBe('not-found');
  });

  it('rejects a blank id rather than guessing', () => {
    for (const id of ['', '   ', null, undefined]) {
      const r = resolveLessonAsset(learner(), id);
      expect(r.ok).toBe(false);
      expect(r.url).toBeUndefined();
    }
  });

  it('never returns a URL alongside a refusal', () => {
    /*
     * The property that matters most. Every denial path must be free of a URL —
     * a refusal carrying the answer would be worse than no gate at all, because
     * it would look protected.
     */
    const denials = [
      resolveLessonAsset(learner({ tier: 'register' }), PAID_ASSET_ID),
      resolveLessonAsset(learner({ programme: '100bm' }), PAID_ASSET_ID),
      resolveLessonAsset({}, PAID_ASSET_ID),
      resolveLessonAsset(learner(), 'no-such-lesson'),
      resolveLessonAsset(learner(), ''),
    ];
    denials.forEach((d) => {
      expect(d.ok).toBe(false);
      expect(d.url).toBeUndefined();
      expect(JSON.stringify(d)).not.toContain('http');
    });
  });
});

describe('asset gate · the catalogue itself', () => {
  it('declares a programme and a payment requirement for every lesson', () => {
    for (const [id, asset] of Object.entries(LESSON_ASSETS)) {
      expect(asset.program, id).toBeTruthy();
      expect(typeof asset.requiresPaid, id).toBe('boolean');
      expect(asset.url, id).toMatch(/^https?:\/\//);
    }
  });

  it('agrees with the shared entitlement decision', () => {
    // The gate must not grow its own idea of who has paid. If these ever
    // disagree, the UI and the server are telling a learner different things.
    const p = learner({ tier: 'register' });
    expect(paidContentDecision(p, 'mbw').allowed).toBe(false);
    expect(resolveLessonAsset(p, PAID_ASSET_ID).ok).toBe(false);
  });
});

/*
 * Batch-wise uploads.
 *
 * Two or three videos per programme are the same for every cohort; the rest are
 * recorded per batch and uploaded by the team, so one lesson id has a different
 * video depending on which batch the learner is in. Without this, every cohort
 * would see whichever recording happened to be in the code.
 */
describe('asset gate · permanent links and per-batch uploads together', () => {
  const AUG = '08/08/2026 - 08/02/2027';
  const JUL = '11/07/2026 - 16/01/2027';

  const inBatch = (batchName, tier = 'paid') => ({
    ...learner({ tier }),
    batchName,
  });

  const media = {
    program: 'mbw',
    requiresPaid: true,
    defaultUrl: 'https://example.test/permanent.mp4',
    byBatch: {
      [AUG]: 'https://example.test/august.mp4',
      [JUL]: 'https://example.test/july.mp4',
    },
  };

  it('gives each batch its own recording', () => {
    expect(resolveLessonAsset(inBatch(AUG), PAID_ASSET_ID, new Date(), media).url).toBe(
      'https://example.test/august.mp4'
    );
    expect(resolveLessonAsset(inBatch(JUL), PAID_ASSET_ID, new Date(), media).url).toBe(
      'https://example.test/july.mp4'
    );
  });

  it('falls back to the permanent link for a batch with nothing uploaded', () => {
    // The case that keeps a half-filled programme working: a new cohort sees
    // the permanent videos until their own recordings arrive.
    const r = resolveLessonAsset(inBatch('01/01/2027 - 01/07/2027'), PAID_ASSET_ID, new Date(), media);
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://example.test/permanent.mp4');
    expect(r.source).toBe('default-stored');
  });

  it('falls back to the code map when nothing is stored at all', () => {
    const r = resolveLessonAsset(inBatch(AUG), PAID_ASSET_ID, new Date(), null);
    expect(r.ok).toBe(true);
    expect(r.source).toBe('permanent');
  });

  it('tells an entitled learner to wait when their recording is missing', () => {
    /*
     * Distinct from a payment refusal on purpose. A learner who has paid and is
     * simply waiting for the team to upload must not be told to pay again.
     */
    const noUrls = { program: 'mbw', requiresPaid: true, byBatch: {} };
    const r = resolveLessonAsset(inBatch(AUG), 'mbw-not-in-code-map', new Date(), noUrls);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-uploaded');
  });

  it('still refuses an unentitled learner even when their batch has a video', () => {
    const r = resolveLessonAsset(inBatch(AUG, 'register'), PAID_ASSET_ID, new Date(), media);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('payment-required');
    expect(JSON.stringify(r)).not.toContain('august');
  });

  it('serves a lesson that exists only as a stored document', () => {
    // Lessons the team adds later will not be in the code map at all.
    const r = resolveLessonAsset(inBatch(AUG), 'mbw-added-later', new Date(), media);
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://example.test/august.mp4');
  });

  it('lets a stored document raise the requirement but never lower it', () => {
    const freeId = knownAssetIds().find((id) => LESSON_ASSETS[id].requiresPaid === false);
    // Raising: a free lesson marked paid in the document is now gated.
    const raised = resolveLessonAsset({}, freeId, new Date(), { program: 'mbw', requiresPaid: true });
    expect(raised.ok).toBe(false);
    // Lowering must not work: the code map is the floor.
    const lowered = resolveLessonAsset(
      learner({ tier: 'register' }),
      PAID_ASSET_ID,
      new Date(),
      { program: 'mbw', requiresPaid: false, byBatch: {} }
    );
    expect(lowered.ok).toBe(false);
  });

  it('ignores a batch name with stray whitespace rather than missing the match', () => {
    const r = resolveLessonAsset(inBatch(`  ${AUG}  `), PAID_ASSET_ID, new Date(), media);
    expect(r.url).toBe('https://example.test/august.mp4');
  });

  it('works for a learner with no batch recorded yet', () => {
    const r = resolveLessonAsset(learner(), PAID_ASSET_ID, new Date(), media);
    expect(r.ok).toBe(true);
    expect(r.source).toBe('default-stored');
  });
});
